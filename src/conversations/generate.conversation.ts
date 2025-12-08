import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands, getMainKeyboard } from '../grammy/keyboards/main.keyboard';
import axios from 'axios';
import { GenerationMode } from '../enum/generation-mode.enum';

interface SafeUser {
    id: string;
    credits: number;
    settings?: { aspectRatio?: string; model?: string; selectedModel?: { inputImagesLimit?: number } };
}

interface GenerationState {
    prompt: string;
    mode: GenerationMode;
    inputImageFileIds: string[];
    skipAspectRatioSelection: boolean;
    mediaGroupId?: string;
    isCommand: boolean;
}

/**
 * Вспомогательная функция: Извлекает начальное состояние из контекста
 */
function extractInitialState(ctx: MyContext): GenerationState {
    let prompt = '';
    let mode: GenerationMode = GenerationMode.TEXT_TO_IMAGE;
    const inputImageFileIds: string[] = [];
    let skipAspectRatioSelection = false;
    let isCommand = false;

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

        if (text) {
            const trimmedText = text.trim();
            if (trimmedText.startsWith('/')) {
                isCommand = true;
                // Special case for /generate command
                if (trimmedText.startsWith('/generate')) {
                    prompt = trimmedText.replace(/^\/generate\s*/, '').trim();
                }
            } else if (!photo?.length) { // If no photo, then text is the prompt
                prompt = trimmedText;
            }
        }
    }

    return {
        prompt,
        mode,
        inputImageFileIds,
        skipAspectRatioSelection,
        mediaGroupId: ctx.message?.media_group_id || ctx.message?.reply_to_message?.media_group_id,
        isCommand
    };
}

/**
 * Вход в режим генерации (Stateless Flow)
 */
export async function enterGenerateFlow(ctx: MyContext) {
    console.log('[GENERATE] Flow started');
    const state = extractInitialState(ctx);
    console.log('[GENERATE] Initial state extracted:', { mode: state.mode, hasPrompt: !!state.prompt, imgCount: state.inputImageFileIds.length, mediaGroupId: state.mediaGroupId });

    // Media Group & Latching Logic
    if (!state.isCommand) {
        let existingStateId: string | undefined;

        // 1. Try Media Group
        if (state.mediaGroupId && ctx.session.generationStates) {
            existingStateId = Object.keys(ctx.session.generationStates).find(key =>
                ctx.session.generationStates![key].mediaGroupId === state.mediaGroupId
            );
            console.log('[GENERATE] Search by MediaGroup:', existingStateId);
        }

        // 2. Try Implicit Context (Latching to latest state in chat)
        // Only if we are sending images (Text latching is handled in processGenerateInput)
        // AND ONLY if this is NOT a new Media Group (Album). Albums should start fresh if not matched above.
        if (!existingStateId && state.inputImageFileIds.length > 0 && !state.mediaGroupId) {
            const latest = findLatestState(ctx);
            if (latest) {
                existingStateId = String(latest.uiMessageId);
                console.log('[GENERATE] Found implicit latest state:', existingStateId);
                // Optional: verify timestamp? For now assume valid if in session.
            } else {
                console.log('[GENERATE] No implicit latest state found');
            }
        }

        if (existingStateId && ctx.session.generationStates) {
            const existingState = ctx.session.generationStates[existingStateId];
            console.log('[GENERATE] Merging into state:', existingStateId);

            // Append new photos if any
            let updated = false;
            for (const fileId of state.inputImageFileIds) {
                if (!existingState.inputImageFileIds.includes(fileId)) {
                    existingState.inputImageFileIds.push(fileId);
                    updated = true;
                }
            }

            // Update prompts if this message has one
            // If user uploads photo with caption, overwrite old text prompt? Yes, presumably refinement.
            if (state.prompt) {
                existingState.prompt = state.prompt;
                updated = true;
            }

            // Upgrade Mode if needed
            if (existingState.inputImageFileIds.length > 0 && existingState.mode === GenerationMode.TEXT_TO_IMAGE) {
                existingState.mode = GenerationMode.IMAGE_TO_IMAGE;
                updated = true;
            }

            if (updated) {
                console.log('[GENERATE] State updated, refreshing UI');
                // Refresh UI of the existing generation menu
                const user = await getUser(ctx);
                const cost = await estimateCost(ctx, user?.id, existingState);
                const canGen = (user?.credits ?? 0) >= cost;
                const shouldAsk = (user?.settings as any)?.askAspectRatio === true || (user as any)?.totalGenerated === 0;

                const modelName = (user?.settings as any)?.model || 'flux-pro';
                const limit = user?.settings?.selectedModel?.inputImagesLimit || 5;
                const ui = buildGenerateUI(existingState.mode, existingState.prompt, existingState.inputImageFileIds.length, cost, canGen, existingState.aspectRatio || '1:1', user?.credits ?? 0, shouldAsk, modelName, limit);

                if (existingState.uiMessageId && existingState.uiChatId) {
                    const currentMsgId = ctx.message?.message_id || 0;
                    const gap = currentMsgId - existingState.uiMessageId;

                    // SMART RESEND: If gap > 2, Resend. Else Edit.
                    if (gap > 2) {
                        try {
                            await ctx.api.deleteMessage(existingState.uiChatId, existingState.uiMessageId);
                        } catch (e) {
                            console.log('[GENERATE] Failed to delete old menu for resend', e);
                        }

                        const m = await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });

                        // Update State ID and Keys
                        const oldId = existingStateId!;
                        const newId = String(m.message_id);

                        existingState.uiMessageId = m.message_id;

                        if (oldId !== newId && ctx.session.generationStates) {
                            ctx.session.generationStates[newId] = existingState;
                            delete ctx.session.generationStates[oldId];
                        }
                        console.log('[GENERATE] Resent menu due to gap:', gap);
                        return;
                    } else {
                        // Edit in place
                        try {
                            await ctx.api.editMessageText(existingState.uiChatId, existingState.uiMessageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
                            console.log('[GENERATE] UI updated successfully for:', existingStateId);
                            return;
                        } catch (e) {
                            console.error('[GENERATE] Failed to update media group UI', e);
                            // If update failed (e.g. message deleted), remove this invalid state and allow creation of new one
                            if (existingStateId && ctx.session.generationStates?.[existingStateId]) {
                                delete ctx.session.generationStates[existingStateId];
                                console.log('[GENERATE] Deleted invalid state:', existingStateId);
                            }
                        }
                    }
                }
            } else {
                // Nothing updated? Maybe already match? 
                console.log('[GENERATE] No updates to state, skipping');
                return;
            }
        }
    }

    // Initial Cost Estimation
    console.log('[GENERATE] Proceeding to new flow creation');
    let cost = 0;
    const user = await getUser(ctx);
    if (user) {
        cost = await estimateCost(ctx, user.id, state);
    }

    const currentRatio = user?.settings?.aspectRatio || '1:1';


    // Fast Path (Skip menu ONLY if it is a Reply/Special flow)
    const canSkip = state.skipAspectRatioSelection && !!state.prompt;

    if (canSkip &&
        (state.mode === GenerationMode.TEXT_TO_IMAGE || state.inputImageFileIds.length > 0)) {
        if (user && user.credits >= cost) {
            console.log('[GENERATE] Fast path taken');
            await performGeneration(ctx, user, state.prompt, state.mode, state.inputImageFileIds, currentRatio);
            return; // Done, no session needed
        }
    }

    // Build UI
    const canGenerate = (user?.credits ?? 0) >= cost;

    // settings.askAspectRatio default is now FALSE in schema.
    const isExplicitlyEnabled = (user?.settings as any)?.askAspectRatio === true;
    const isFirstTime = (user as any)?.totalGenerated === 0;

    const shouldAsk = isExplicitlyEnabled || isFirstTime;
    const modelName = (user?.settings as any)?.model || 'flux-pro';
    const limit = user?.settings?.selectedModel?.inputImagesLimit || 5;
    const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, canGenerate, currentRatio, user?.credits ?? 0, shouldAsk, modelName, limit);

    // Send Main Keyboard first (as requested previously) - Actually assuming it's there or attached
    console.log('[GENERATE] Sending new UI message');
    const m = await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
    console.log('[GENERATE] UI message sent:', m.message_id);

    // Save to Session (Multi-State)
    if (!ctx.session.generationStates) {
        ctx.session.generationStates = {};
    }

    ctx.session.generationStates[String(m.message_id)] = {
        prompt: state.prompt,
        mode: state.mode,
        inputImageFileIds: state.inputImageFileIds,
        aspectRatio: currentRatio,
        uiMessageId: m.message_id,
        uiChatId: ctx.chat?.id,
        mediaGroupId: state.mediaGroupId
    };
    console.log('[GENERATE] New state saved:', m.message_id);
}

/**
 * Обработка ввода в режиме генерации
 * Возвращает true, если сообщение обработано и не должно идти дальше
 */
export async function processGenerateInput(ctx: MyContext): Promise<boolean> {

    // 1. Handle Regeneration (Global trigger)
    if (ctx.callbackQuery?.data?.startsWith('regenerate_')) {
        const generationId = ctx.callbackQuery.data.split('_')[1];
        await handleRegeneration(ctx, generationId);
        // We don't delete UI message here as it might be from history
        await ctx.answerCallbackQuery();
        return true;
    }

    // 2. Determine Message ID to find State
    let messageId: number | undefined;

    if (ctx.callbackQuery?.message) {
        messageId = ctx.callbackQuery.message.message_id;
    } else if (ctx.message?.reply_to_message) {
        // If user replies to a menu message
        messageId = ctx.message.reply_to_message.message_id;
    }

    if (!messageId) return false;

    // 3. Find State
    const states = ctx.session.generationStates || {};
    let state = states[String(messageId)];

    if (!state) {
        // If we found a messageId (e.g. callback) but no state -> Expired or unknown
        if (ctx.callbackQuery) {
            const data = ctx.callbackQuery.data;
            if (data && (data.startsWith('aspect_') || ['generate_trigger', 'buy_credits', 'cancel_generation'].includes(data))) {
                await ctx.answerCallbackQuery({ text: '⚠️ Меню устарело.' });
                // Optional: try to delete if really old? No, user said keep it.
                return true;
            }
        }
        return false;
    }

    // Validate Chat ID (ensure we are in the same chat)
    if (ctx.chat?.id !== state.uiChatId) return false;

    const user = await getUser(ctx);
    let updated = false;

    // 4. Handle Inputs
    if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        if (!data) return false;

        // Recalculate cost
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
                // We do NOT delete UI message anymore
                // Perform generation
                await performGeneration(ctx, user, state.prompt, state.mode, state.inputImageFileIds, state.aspectRatio || '1:1');

                // Optional: Cleanup state after successful generation to prevent double-click or reuse?
                // User said "let them remove old messages if they want".
                // If we keep state, they can regenerate. That's fine.
                return true;
            }
        } else if (data === 'buy_credits') {
            await ctx.answerCallbackQuery();
            await ctx.conversation.enter('buy_credits');
            return true;
        } else if (data === 'cancel_generation') {
            await ctx.answerCallbackQuery();
            // Remove state for this message
            delete states[String(messageId)];

            // "Cancel" implies "I don't want this". Usually we delete.
            try { await ctx.deleteMessage(); } catch { }
            return true;
        } else {
            return false;
        }
    } else if (ctx.message?.photo) {
        // handle photo reply
        const newId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        if (!state.inputImageFileIds.includes(newId)) {
            state.inputImageFileIds.push(newId);
            state.mode = GenerationMode.IMAGE_TO_IMAGE;
            if (ctx.message.caption) state.prompt = ctx.message.caption.trim();
            updated = true;
        }
        // Delete user's photo message to keep chat clean? Or keep it?
        // Let's keep it to be safe.
    } else if (ctx.message?.text) {
        // Handle text reply to menu
        const text = ctx.message.text;
        if (text.startsWith('/')) return false;

        if (Object.values(KeyboardCommands).includes(text as any)) {
            // Main menu command -> Exit?
            return false; // Propagate
        }

        // Implicit Context: if no explicit reply, check if we can latch onto the latest image state
        if (!state) {
            const latest = findLatestState(ctx);
            // Only latch if latest state has images (User sent photos, then adds caption)
            if (latest && latest.inputImageFileIds.length > 0) {
                // Use this state
                state = latest;
            } else {
                return false; // Not a reply, and no suitable recent state -> New Generation
            }
        }

        // Append text to existing prompt
        state.prompt = text;

        // try { await ctx.deleteMessage(); } catch { } // Don't delete user's text input
        updated = true;
    }

    if (updated) {
        // Save state back? It's a reference, but for Redis we might need to touch session?
        // Grammy session uses Proxy, so mutation is usually tracked.

        // Re-estimate cost
        const cost = await estimateCost(ctx, user?.id, state);
        const canGen = (user?.credits ?? 0) >= cost;
        const shouldAsk = (user?.settings as any)?.askAspectRatio === true || (user as any)?.totalGenerated === 0;
        const modelName = (user?.settings as any)?.model || 'flux-pro';
        const limit = user?.settings?.selectedModel?.inputImagesLimit || 5;
        const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, canGen, state.aspectRatio || '1:1', user?.credits ?? 0, shouldAsk, modelName, limit);
        if (state.uiMessageId && state.uiChatId) {
            let shouldResend = false;
            // Only resend if this was a user reply (message exists) and gap is significant
            if (ctx.message) {
                const gap = ctx.message.message_id - state.uiMessageId;
                if (gap > 2) shouldResend = true;
            }

            if (shouldResend) {
                try {
                    await ctx.api.deleteMessage(state.uiChatId, state.uiMessageId);
                } catch { }

                const m = await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });

                // Update State Keys
                // processGenerateInput uses reference `state`, but we need to update the Key in Session
                const oldId = String(state.uiMessageId);
                const newId = String(m.message_id);

                state.uiMessageId = m.message_id;

                if (oldId !== newId && ctx.session.generationStates) {
                    ctx.session.generationStates[newId] = state;
                    delete ctx.session.generationStates[oldId];
                }
            } else {
                try {
                    await ctx.api.editMessageText(state.uiChatId, state.uiMessageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
                } catch { }
            }
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

// No deleteUiMessage function needed anymore

function buildGenerateUI(
    mode: GenerationMode,
    prompt: string,
    imgCount: number,
    cost: number,
    canGenerate: boolean,
    currentRatio: string,
    userBalance: number = 0,
    showAspectRatioOptions: boolean = true,
    modelName: string = 'flux-pro',
    limit: number = 5
) {
    const keyboard = new InlineKeyboard();
    let messageText = '';

    const effectiveImgCount = Math.min(imgCount, limit);
    const isLimitExceeded = imgCount > limit;

    if (mode === GenerationMode.TEXT_TO_IMAGE) {
        messageText = prompt
            ? `📝 Ваш запрос: <b>${prompt}</b>`
            : `✍️ Напиши описание для генерации картинки и отправь его!`;
    } else {
        messageText += imgCount > 0
            ? `✅ Изображений загружено: ${imgCount}${isLimitExceeded ? ` ⚠️ (Лимит: ${limit})` : ''}\n`
            : `📥 <b>Отправьте изображение или альбом</b> для обработки.\n`;

        if (isLimitExceeded) {
            messageText += `⚠️ <i>Внимание: Будут использованы первые ${limit} изображений.</i>\n`;
        }

        messageText += prompt
            ? `📝 Ваш запрос: <b>${prompt}</b>\n`
            : `✍️ <b>Напиши описание</b> изменений или стиля.\n`;
    }

    // Add Model, Ratio, Cost, Balance
    messageText += `\n\n🤖 Модель: <b>${modelName}</b>`;
    messageText += `\n📐 Соотношение: <b>${currentRatio}</b>`;
    messageText += `\n💰 Стоимость: <b>${cost.toFixed(2)} ₽</b>`;
    messageText += `\n💳 Баланс: <b>${userBalance.toFixed(2)} ₽</b>`;

    const readyToGenerate = mode === GenerationMode.TEXT_TO_IMAGE ? !!prompt : (imgCount > 0);

    if (readyToGenerate) {
        if (canGenerate) {
            if (showAspectRatioOptions) {
                const ratios = ['1:1', '16:9', '9:16', '3:4', '4:3'];
                ratios.forEach((r, i) => {
                    const label = r === currentRatio ? `✅ ${r}` : r;
                    keyboard.text(label, `aspect_${r}`);
                    if ((i + 1) % 3 === 0) keyboard.row();
                });
                if (ratios.length % 3 !== 0) keyboard.row();
            }
            keyboard.text('🎨 Сгенерировать!', 'generate_trigger').row();
            keyboard.text('✨ Отмена', 'cancel_generation').row();

            messageText += `\n\nНажмите кнопку ниже, чтобы начать.`;
        } else {
            keyboard.text('💳 Пополнить баланс', 'buy_credits').row();
            messageText += `\n\n⚠️ <b>Недостаточно средств!</b>\nДля генерации требуется ${cost.toFixed(2)} руб.\nВаш баланс: <b>${userBalance.toFixed(2)}</b> руб.`;
        }
    }

    return { text: messageText, keyboard };
}

function findLatestState(ctx: MyContext) {
    if (!ctx.session.generationStates) return undefined;
    const all = Object.values(ctx.session.generationStates);
    if (all.length === 0) return undefined;

    // Filter by current chat
    const inChat = all.filter(s => s.uiChatId === ctx.chat?.id);
    if (inChat.length === 0) return undefined;

    // Sort by uiMessageId descending (newest first)
    inChat.sort((a, b) => (b.uiMessageId || 0) - (a.uiMessageId || 0));

    const latest = inChat[0];

    // Check if latest state is "fresh enough"
    // If the gap between current message and menu is too large, assume context lost.
    // ctx.message?.message_id might be undefined if not available, but usually is.
    if (ctx.message?.message_id && latest.uiMessageId) {
        const gap = ctx.message.message_id - latest.uiMessageId;
        if (gap > 20) return undefined; // Too old, start new
    }

    return latest;
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

            const limit = user.settings?.selectedModel?.inputImagesLimit || 5;
            const filesToProcess = inputImageFileIds.slice(0, limit);

            for (const fileId of filesToProcess) {
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

        // Restore Main Keyboard explicitly
        await ctx.reply('Готово! ✨', { reply_markup: getMainKeyboard() });

    } catch (error: any) {
        try { await ctx.api.deleteMessage(ctx.chat!.id, statusMsgId); } catch { }
        await ctx.reply(`❌ Ошибка генерации:\n${error.message || 'Неизвестная ошибка'}`, { reply_markup: getMainKeyboard() });
    }
}