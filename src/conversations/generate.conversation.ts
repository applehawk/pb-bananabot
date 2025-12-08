import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands, getMainKeyboard } from '../grammy/keyboards/main.keyboard';
import axios from 'axios';
import { GenerationMode } from '../enum/generation-mode.enum';

interface SafeUser {
    id: string;
    credits: number;
    settings?: { aspectRatio?: string };
}

interface GenerationState {
    prompt: string;
    mode: GenerationMode;
    inputImageFileIds: string[];
    skipAspectRatioSelection: boolean;
}

/**
 * Вспомогательная функция: Извлекает начальное состояние из контекста
 */
function extractInitialState(ctx: MyContext): GenerationState {
    let prompt = '';
    let mode: GenerationMode = GenerationMode.TEXT_TO_IMAGE;
    const inputImageFileIds: string[] = [];
    let skipAspectRatioSelection = false;

    // 1. Проверка Reply (ответ на сообщение)
    if (ctx.message?.reply_to_message) {
        const replyMsg = ctx.message.reply_to_message;

        if (replyMsg.photo?.length) {
            mode = GenerationMode.IMAGE_TO_IMAGE;
            inputImageFileIds.push(replyMsg.photo[replyMsg.photo.length - 1].file_id);
        }

        prompt = (ctx.message.text || ctx.message.caption || replyMsg.caption || replyMsg.text || '').trim();
        skipAspectRatioSelection = true;
    }
    // 2. Проверка текущего сообщения
    else if (ctx.message) {
        const { text, caption, photo } = ctx.message;

        if (photo?.length) {
            mode = GenerationMode.IMAGE_TO_IMAGE;
            inputImageFileIds.push(photo[photo.length - 1].file_id);
            if (caption) prompt = caption.trim();
        } else if (text) {
            const extracted = text.replace(/^\/generate\s*/, '').trim();
            // Если текст не пустой и не равен команде - это промпт
            if (extracted && extracted !== '/generate') prompt = extracted;
        }
    }

    return { prompt, mode, inputImageFileIds, skipAspectRatioSelection };
}

/**
 * Вход в режим генерации (Stateless Flow)
 */
export async function enterGenerateFlow(ctx: MyContext) {
    console.log('[GENERATE] Flow started');
    const state = extractInitialState(ctx);

    // Initial Cost Estimation
    let cost = 0;
    const user = await getUser(ctx);
    if (user) {
        cost = await estimateCost(ctx, user.id, state);
    }

    const currentRatio = user?.settings?.aspectRatio || '1:1';

    // Check "Ask Aspect Ratio" setting
    // Logic: 
    // 1. If user explicitly enabled it (askAspectRatio === true) -> Ask
    // 2. If it's the FIRST generation ever (totalGenerated === 0) -> Ask (to introduce the feature)
    // 3. Otherwise -> Skip if prompt is ready

    // settings.askAspectRatio default is now FALSE in schema.
    const isExplicitlyEnabled = (user?.settings as any)?.askAspectRatio === true;
    const isFirstTime = (user as any)?.totalGenerated === 0;

    const shouldAsk = isExplicitlyEnabled || isFirstTime;

    // Fast Path (Reply with everything ready AND we shouldn't ask)
    const canSkip = !shouldAsk && !!state.prompt;

    if (canSkip && state.skipAspectRatioSelection &&
        (state.mode === GenerationMode.TEXT_TO_IMAGE || state.inputImageFileIds.length > 0)) {
        if (user && user.credits >= cost) {
            await performGeneration(ctx, user, state.prompt, state.mode, state.inputImageFileIds, currentRatio);
            return; // Done, no session needed
        }
    }

    // Cleanup previous UI if exists
    if (ctx.session.generationState?.uiMessageId && ctx.session.generationState?.uiChatId) {
        try { await ctx.api.deleteMessage(ctx.session.generationState.uiChatId, ctx.session.generationState.uiMessageId); } catch { }
    }

    // Save to Session
    ctx.session.generationState = {
        prompt: state.prompt,
        mode: state.mode,
        inputImageFileIds: state.inputImageFileIds,
        aspectRatio: currentRatio,
        uiMessageId: undefined, // will be set below
        uiChatId: ctx.chat?.id
    };

    // Build UI
    const canGenerate = (user?.credits ?? 0) >= cost;
    const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, canGenerate, currentRatio, user?.credits ?? 0);

    // Send Main Keyboard first (as requested previously)

    const m = await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });

    // Update session with message ID
    if (ctx.session.generationState) {
        ctx.session.generationState.uiMessageId = m.message_id;
    }
}

/**
 * Обработка ввода в режиме генерации
 * Возвращает true, если сообщение обработано и не должно идти дальше
 */
export async function processGenerateInput(ctx: MyContext): Promise<boolean> {

    // 1. Handle Regeneration (Global trigger, essentially)
    if (ctx.callbackQuery?.data?.startsWith('regenerate_')) {
        const generationId = ctx.callbackQuery.data.split('_')[1];
        await handleRegeneration(ctx, generationId);
        await deleteUiMessage(ctx); // if any exists in session
        return true;
    }

    // 2. Check Session State
    const state = ctx.session.generationState;
    if (!state) return false;

    // Validate Chat ID (ensure we are in the same chat)
    if (ctx.chat?.id !== state.uiChatId) return false;

    // Validate Message ID for callbacks to prevent stale menu interactions (except regeneration which is global-ish, but handled above)
    if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.message_id !== state.uiMessageId) {
        // If it's a generation button but NOT the current UI, ignore or warn
        // Regeneration is already handled.
        // If it's aspect_, generate_trigger etc from OLD message:
        const data = ctx.callbackQuery.data;
        if (data && (data.startsWith('aspect_') || ['generate_trigger', 'buy_credits', 'cancel_generation'].includes(data))) {
            await ctx.answerCallbackQuery({ text: '⚠️ Меню устарело.' });
            try { await ctx.deleteMessage(); } catch { }
            return true;
        }
        // If unrelated callback, let it pass (return false)
        return false;
    }

    const user = await getUser(ctx);
    let updated = false;

    // 3. Handle Inputs
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (!data) return false;

        // Recalculate cost first (needed for buy check)
        const cost = await estimateCost(ctx, user?.id, state);

        if (data.startsWith('aspect_')) {
            state.aspectRatio = data.split('_')[1];
            if (user) await ctx.userService.updateSettings(user.id, { aspectRatio: state.aspectRatio });
            updated = true;
        } else if (data === 'generate_trigger') {
            if (!state.prompt) {
                await ctx.answerCallbackQuery({ text: '❌ Введите описание!' });
                return true;
            }
            if (!state.prompt || (state.mode === GenerationMode.IMAGE_TO_IMAGE && state.inputImageFileIds.length === 0)) {
                await ctx.answerCallbackQuery({ text: '❌ Загрузите изображение!' });
                return true;
            }

            if (!user || user.credits < cost) {
                await ctx.answerCallbackQuery({ text: '❌ Недостаточно средств!', show_alert: true });
                updated = true; // refresh UI
            } else {
                await ctx.answerCallbackQuery();
                await deleteUiMessage(ctx);
                ctx.session.generationState = undefined; // Clear state
                await performGeneration(ctx, user, state.prompt, state.mode, state.inputImageFileIds, state.aspectRatio || '1:1');
                return true;
            }
        } else if (data === 'buy_credits') {
            await ctx.answerCallbackQuery();
            await deleteUiMessage(ctx);
            ctx.session.generationState = undefined;
            await ctx.conversation.enter('buy_credits');
            return true;
        } else if (data === 'cancel_generation') {
            await ctx.answerCallbackQuery();
            await deleteUiMessage(ctx);
            ctx.session.generationState = undefined;
            await ctx.reply('🎨 Готов к новым шедеврам! ✨', { reply_markup: getMainKeyboard() });
            return true;
        } else {
            // Not a generation button
            return false;
        }
    } else if (ctx.message?.photo) {
        // handle photo
        const newId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        if (!state.inputImageFileIds.includes(newId)) {
            state.inputImageFileIds.push(newId);
            state.mode = GenerationMode.IMAGE_TO_IMAGE;
            if (ctx.message.caption) state.prompt = ctx.message.caption.trim();
            updated = true;
        }
    } else if (ctx.message?.text) {
        const text = ctx.message.text;
        if (text.startsWith('/')) return false; // Let commands pass

        // If "Main Keyboard" is clicked, exit generation mode
        if (Object.values(KeyboardCommands).includes(text as any)) {
            await deleteUiMessage(ctx);
            ctx.session.generationState = undefined;
            return false; // Let it propagate to main handler
        }

        state.prompt = text;
        try { await ctx.deleteMessage(); } catch { }
        updated = true;
    }

    if (updated) {
        // Re-estimate cost
        const cost = await estimateCost(ctx, user?.id, state);
        const canGen = (user?.credits ?? 0) >= cost;
        const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, canGen, state.aspectRatio || '1:1', user?.credits ?? 0);
        if (state.uiMessageId && state.uiChatId) {
            try {
                await ctx.api.editMessageText(state.uiChatId, state.uiMessageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
            } catch { }
        }
    }

    return true; // We handled it
}

// --- Internal Helpers ---

async function getUser(ctx: MyContext): Promise<SafeUser | null> {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    const dbUser = await ctx.userService.findByTelegramId(telegramId);
    if (!dbUser) return null;
    const u = dbUser as any;
    return {
        id: u.id,
        credits: u.credits,
        settings: u.settings
    };
}

async function estimateCost(ctx: MyContext, userId: string | undefined, state: any): Promise<number> {
    if (!userId) return 0;
    if (state.mode === GenerationMode.TEXT_TO_IMAGE) {
        return await ctx.generationService.estimateCost(userId, { mode: 'text', numberOfImages: 1 });
    } else {
        const count = Math.max(1, state.inputImageFileIds.length);
        return await ctx.generationService.estimateCost(userId, { mode: 'image', numberOfImages: count });
    }
}

async function deleteUiMessage(ctx: MyContext) {
    const st = ctx.session.generationState;
    if (st?.uiMessageId && st?.uiChatId) {
        try { await ctx.api.deleteMessage(st.uiChatId, st.uiMessageId); } catch { }
    }
}

function buildGenerateUI(
    mode: GenerationMode,
    prompt: string,
    imgCount: number,
    cost: number,
    canGenerate: boolean,
    currentRatio: string,
    userBalance: number = 0
) {
    const keyboard = new InlineKeyboard();
    let messageText = '';

    if (mode === GenerationMode.TEXT_TO_IMAGE) {
        messageText = prompt
            ? `ваш запрос: <b>${prompt}</b>`
            : `✍️ Напиши описание для генерации картинки и отправь его!`;
    } else {
        messageText += imgCount > 0
            ? `✅ Изображений загружено: ${imgCount}\n`
            : `📥 <b>Отправьте изображение или альбом</b> для обработки.\n`;

        messageText += prompt
            ? `📝 Ваш запрос: <b>${prompt}</b>\n`
            : `✍️ <b>Напиши описание</b> изменений или стиля.\n`;
    }

    const readyToGenerate = mode === GenerationMode.TEXT_TO_IMAGE ? !!prompt : (!!prompt && imgCount > 0);

    if (readyToGenerate) {
        if (canGenerate) {
            const ratios = ['1:1', '16:9', '9:16', '3:4', '4:3'];
            ratios.forEach((r, i) => {
                const label = r === currentRatio ? `✅ ${r}` : r;
                keyboard.text(label, `aspect_${r}`);
                if ((i + 1) % 3 === 0) keyboard.row();
            });
            if (ratios.length % 3 !== 0) keyboard.row();
            keyboard.text('🎨 Сгенерировать!', 'generate_trigger').row();
            keyboard.text('❌ Отмена генерации', 'cancel_generation').row();

            messageText += `\n\nНажмите кнопку ниже, чтобы начать.`;
        } else {
            keyboard.text('💳 Пополнить баланс', 'buy_credits').row();
            messageText += `\n\n⚠️ <b>Недостаточно средств!</b>\nДля генерации требуется ${cost.toFixed(2)} руб.\nВаш баланс: <b>${userBalance.toFixed(2)}</b> руб.`;
        }
    }

    return { text: messageText, keyboard };
}


async function handleRegeneration(ctx: MyContext, generationId: string) {
    const dbUser = await ctx.userService.findByTelegramId(ctx.from?.id);
    if (!dbUser) return;

    // Typecast to any to access properties if TS complains
    const u = dbUser as any;

    // Use try-catch for external service calls
    let gen;
    try {
        gen = await ctx.generationService.getById(generationId);
    } catch {
        await ctx.reply('❌ Генерация не найдена', { reply_markup: getMainKeyboard() });
        return;
    }

    if (!gen) return;

    const inputImageFileIds = Array.isArray(gen.inputImages)
        ? gen.inputImages.map((i: any) => String(i.fileId)).filter(Boolean)
        : [];

    const mode = (gen.type === 'IMAGE_TO_IMAGE' || gen.type === 'MULTI_IMAGE') ? GenerationMode.IMAGE_TO_IMAGE : GenerationMode.TEXT_TO_IMAGE;
    const imgCount = inputImageFileIds.length;

    // Estimate cost
    let cost = 0;
    if (mode === GenerationMode.TEXT_TO_IMAGE) {
        cost = await ctx.generationService.estimateCost(String(u.id), { mode: 'text', numberOfImages: 1 });
    } else {
        cost = await ctx.generationService.estimateCost(String(u.id), { mode: 'image', numberOfImages: imgCount });
    }

    const user: SafeUser = {
        id: u.id,
        credits: u.credits,
        settings: u.settings
    };

    if (user.credits < cost) {
        await ctx.reply('❌ Недостаточно кредитов', { reply_markup: getMainKeyboard() });
        return;
    }

    await ctx.reply('🔄 Повторная генерация...', { reply_markup: getMainKeyboard() });
    await performGeneration(ctx, user, gen.prompt, mode, inputImageFileIds, gen.aspectRatio);
}

// Interface for generation result
interface GenerationResult {
    id: string;
    processingTime: number;
    imageUrl?: string | null;
    fileId?: string | null;
    imageDataBase64?: string | null;
    creditsUsed: number;
}

async function performGeneration(
    ctx: MyContext,
    user: SafeUser,
    prompt: string,
    mode: GenerationMode,
    inputImageFileIds: string[],
    currentRatio: string
) {
    // 1. Send Status Message
    const m = await ctx.reply(
        `🎨 Генерирую...\n⏱ 5 - 10 секунд\n\n"${prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}"`,
        { reply_markup: getMainKeyboard() }
    );
    const statusMsgId = m.message_id;

    try {
        // 2. Perform Generation
        let gen: any;
        let result: GenerationResult;

        if (mode === GenerationMode.TEXT_TO_IMAGE) {
            gen = await ctx.generationService.generateTextToImage({
                userId: user.id,
                prompt,
                aspectRatio: currentRatio,
            });
        } else {
            const imageBuffers: Array<{ buffer: Buffer; mimeType: string; fileId?: string }> = [];
            const token = process.env.TELEGRAM_BOT_TOKEN;

            for (const fileId of inputImageFileIds) {
                if (!fileId) continue;
                try {
                    const file = await ctx.api.getFile(fileId);
                    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
                    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' }); // Need axios import
                    const buffer = Buffer.from(response.data);
                    imageBuffers.push({
                        buffer,
                        mimeType: 'image/jpeg',
                        fileId
                    });
                } catch (e) {
                    console.error('Failed to download image', fileId, e);
                }
            }

            gen = await ctx.generationService.generateImageToImage({
                userId: user.id,
                prompt,
                inputImages: imageBuffers,
                aspectRatio: currentRatio,
            });
        }

        result = {
            id: String(gen.id),
            processingTime: Number(gen.processingTime),
            imageUrl: gen.imageUrl ? String(gen.imageUrl) : null,
            fileId: gen.fileId ? String(gen.fileId) : null,
            imageDataBase64: gen.imageData ? gen.imageData.toString('base64') : null,
            creditsUsed: Number(gen.creditsUsed || 0)
        };

        // 3. Delete Status Message
        try { await ctx.api.deleteMessage(ctx.chat!.id, statusMsgId); } catch { }

        // 4. Send Result
        const caption =
            `🎨 ${prompt}\n\n` +
            `💎 Использовано: ${(result.creditsUsed).toFixed(2)} руб.\n` +
            `💰 Осталось: ${(user.credits - result.creditsUsed).toFixed(2)} руб.\n` +
            `⏱ ${(result.processingTime / 1000).toFixed(1)}с`;

        const keyboard = {
            inline_keyboard: [[
                { text: '🔄 Вариация', callback_data: `regenerate_${result.id}` },
                { text: '📜 История', callback_data: 'history' }
            ]]
        };

        const source = result.fileId || result.imageUrl;

        if (source) {
            await ctx.replyWithPhoto(source, { caption, reply_markup: keyboard });
        } else if (result.imageDataBase64) {
            const buffer = Buffer.from(result.imageDataBase64, 'base64');
            await ctx.replyWithPhoto(new InputFile(buffer), { caption, reply_markup: keyboard });
        } else {
            await ctx.reply(`✅ Генерация ID: ${result.id} завершена, но нет изображения для отображения.`, { reply_markup: getMainKeyboard() });
        }

    } catch (error: any) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, statusMsgId); } catch { }
        await ctx.reply(`❌ Ошибка генерации:\n${error.message || 'Неизвестная ошибка'}`, { reply_markup: getMainKeyboard() });
    }
}