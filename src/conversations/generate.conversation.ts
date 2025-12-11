import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands, getMainKeyboard } from '../grammy/keyboards/main.keyboard';
import { GENERATION_PHRASES } from '../constants/generation.phrases';
import axios from 'axios';
import { GenerationMode } from '../enum/generation-mode.enum';

interface SafeUser {
    id: string;
    credits: number;
    totalGenerated: number;
    settings?: { aspectRatio?: string; model?: string; selectedModel?: { inputImagesLimit?: number } };
}

interface GenerationState {
    prompt: string;
    mode: GenerationMode;
    inputImageFileIds: string[];
    skipAspectRatioSelection?: boolean;
    mediaGroupId?: string;
    isCommand?: boolean;
    uiMessageId?: number;
    uiChatId?: number;
    aspectRatio?: string;
    createdAt?: number;
}

// ... (existing code)

// Map to store active debounce timers: ChatId -> Timeout


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

        // DISABLED: User requested new images (separate messages) to always start NEW state, not latch.
        // Previously we checked findLatestState() here. Now we skip it to force new UI.
        /* 
        if (!existingStateId && state.inputImageFileIds.length > 0 && !state.mediaGroupId) {
             const latest = findLatestState(ctx);
             // ...
        } 
        */

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
                console.log('[GENERATE] State updated, scheduling UI refresh');

                const hasNewImages = state.inputImageFileIds.length > 0;

                if (existingState.uiChatId) {
                    await updateGenerationUI(ctx, existingStateId!, existingState);
                }
                return; // Stop here, do not create new UI
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
    const modelName = (user?.settings as any)?.selectedModel?.displayName || (user?.settings as any)?.model || 'flux-pro';
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
        mediaGroupId: state.mediaGroupId,
        createdAt: Date.now()
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

    // 3. Find State
    let state: GenerationState | undefined;

    if (messageId) {
        // 3. Find State by ID
        const states = ctx.session.generationStates || {};
        state = states[String(messageId)];

        if (!state) {
            // If we found a messageId (e.g. callback) but no state -> Expired or unknown
            if (ctx.callbackQuery) {
                const data = ctx.callbackQuery.data;
                if (data && (data.startsWith('aspect_') || ['generate_trigger', 'cancel_generation'].includes(data))) {
                    await ctx.answerCallbackQuery({ text: '⚠️ Меню устарело.' });
                    return true;
                }
            }
            return false;
        }
    } else if (ctx.message?.text) {
        // No explicit message ID (not a reply), but it is a text message.
        const text = ctx.message.text;
        if (text.startsWith('/')) return false;
        if (Object.values(KeyboardCommands).includes(text as any)) return false;

        // Try to find the latest state to latch onto.
        // Rule: Only latch to latest state if it has IMAGES but NO PROMPT.
        const latest = findLatestState(ctx);

        if (latest && latest.inputImageFileIds.length > 0 && !latest.prompt) {
            state = latest;
        } else {
            // Otherwise, start fresh (return false -> entering enterGenerateFlow)
            return false;
        }
    } else {
        // Not a callback, not a reply, not a text message -> ignore
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
            await ctx.answerCallbackQuery();
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

                // User requested deletion here for consistency with 'cancel'
                try { await ctx.deleteMessage(); } catch { }

                // Perform generation
                await performGeneration(ctx, user, state.prompt, state.mode, state.inputImageFileIds, state.aspectRatio || '1:1');

                // Cleanup state to prevent latching of new messages to this finished flow
                if (ctx.session.generationStates) {
                    if (state.uiMessageId) delete ctx.session.generationStates[String(state.uiMessageId)];
                    if (messageId) delete ctx.session.generationStates[String(messageId)];
                }

                return true;
            }
        } else if (data === 'buy_credits') {
            await ctx.answerCallbackQuery();
            await ctx.conversation.enter('buy_credits');
            return true;
        } else if (data === 'cancel_generation') {
            await ctx.answerCallbackQuery();
            // Remove state for this message
            if (ctx.session.generationStates) {
                delete ctx.session.generationStates[String(messageId)]; // messageId might be undefined if text latch? No, state found.
                // If state found via latch (no messageId variable), use state.uiMessageId
                if (state.uiMessageId) {
                    delete ctx.session.generationStates[String(state.uiMessageId)];
                } else if (messageId) {
                    delete ctx.session.generationStates[String(messageId)];
                }
            }

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
        // Handle text reply to menu (or latched text)
        const text = ctx.message.text;

        // Append text to existing prompt? Or set it?
        // If we latched because "no prompt", then Set it. 
        // If we latched (unlikely with new logic) to existing prompt, maybe append?
        // New logic says: latch ONLY if !latest.prompt. So we set it.
        state.prompt = text;
        updated = true;
    }

    if (updated) {
        // Save state back? It's a reference, but for Redis we might need to touch session?
        // Grammy session uses Proxy, so mutation is usually tracked.

        if (state.uiChatId) {
            let key = String(state!.uiMessageId);
            if (messageId) key = String(messageId);
            await updateGenerationUI(ctx, key, state!);
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
        totalGenerated: u.totalGenerated || 0,
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

async function updateGenerationUI(ctx: MyContext, existingStateId: string, existingState: GenerationState) {
    if (!existingState.uiChatId || !existingState.uiMessageId) return;

    const user = await getUser(ctx);
    const cost = await estimateCost(ctx, user?.id, existingState);
    const canGen = (user?.credits ?? 0) >= cost;
    const shouldAsk = (user?.settings as any)?.askAspectRatio === true || (user as any)?.totalGenerated === 0;

    const modelName = (user?.settings as any)?.selectedModel?.displayName || (user?.settings as any)?.model || 'flux-pro';
    const limit = user?.settings?.selectedModel?.inputImagesLimit || 5;
    const ui = buildGenerateUI(existingState.mode, existingState.prompt, existingState.inputImageFileIds.length, cost, canGen, existingState.aspectRatio || '1:1', user?.credits ?? 0, shouldAsk, modelName, limit);

    const currentMsgId = ctx.message?.message_id || 0;
    const gap = currentMsgId - existingState.uiMessageId;

    let shouldResend = false;
    // Condition 1: Gap is too large (scrolled away)
    // User requested to keep message if close enough (e.g. within album size of 10)
    if (gap > 20) shouldResend = true;

    // Try to edit first if we don't need to resend
    if (!shouldResend) {
        try {
            await ctx.api.editMessageText(existingState.uiChatId, existingState.uiMessageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
            console.log('[GENERATE] UI updated successfully in place');
            return; // We are done
        } catch (e: any) {
            const err = e.description || e.message || '';
            if (err.includes('message is not modified')) {
                console.log('[GENERATE] Message not modified, skipping.');
                return;
            }
            if (err.includes('message to edit not found') || err.includes('message can\'t be edited')) {
                console.log('[GENERATE] Message missing or uneditable, forcing resend.');
                shouldResend = true;
            } else {
                console.error('[GENERATE] Failed to update media group UI', e);
                // Other errors (e.g. blocked user?) - maybe cleanup?
                // Let's keep state for now unless it's critical, but typically we just fail here.
                return;
            }
        }
    }

    if (shouldResend) {
        // Special Checks for Deletion Logic
        let shouldDeleteOld = true;
        if (ctx.message?.text) {
            shouldDeleteOld = false;
        }
        try {
            if (shouldDeleteOld) {
                await ctx.api.deleteMessage(existingState.uiChatId, existingState.uiMessageId);
            } else {
                // Remove buttons
                await ctx.api.editMessageReplyMarkup(existingState.uiChatId, existingState.uiMessageId, { reply_markup: { inline_keyboard: [] } });
            }
        } catch (e) {
            console.log('[GENERATE] Failed to delete/edit old menu', e);
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
        console.log('[GENERATE] Resent menu due to gap/input/error');
    }
}


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

    // Logic: Text mode needs prompt. Image mode needs images AND prompt.
    const isTextMode = mode === GenerationMode.TEXT_TO_IMAGE;
    const hasPrompt = !!prompt;
    const hasImages = imgCount > 0;

    const readyToGenerate = isTextMode ? hasPrompt : (hasImages && hasPrompt);

    if (isTextMode) {
        messageText = prompt
            ? `📝 Ваш запрос: <b>${prompt ? prompt : '\'Необходим текст описания генерации!\''}</b>`
            : `✍️ Напиши описание для генерации картинки и отправь его!`;
    } else {
        messageText += imgCount > 0
            ? `✅ Изображений загружено: ${imgCount}${isLimitExceeded ? ` ⚠️ (Лимит: ${limit})` : ''}\n`
            : `📥 <b>Отправьте изображение или альбом</b> для обработки.\n`;

        if (isLimitExceeded) {
            messageText += `⚠️ <i>Внимание: Будут использованы первые ${limit} изображений.</i>\n`;
        }

        if (hasPrompt) {
            messageText += `📝 Ваш запрос: <b>${prompt}</b>\n`;
        } else {
            messageText += `📝 Ваш запрос: <b>${prompt || ''}</b>\n✍️ Напиши описание для генерации картинки и отправь его!\n`;
        }
    }

    // Add Model, Ratio, Cost, Balance
    if (readyToGenerate) {
        messageText += `\n\n🤖 Модель: <b>${modelName}</b>`;
        messageText += `\n📐 Соотношение: <b>${currentRatio}</b>`;
        messageText += `\n💰 Стоимость: <b>${cost.toFixed(2)} монет</b>`;
        messageText += `\n💳 Баланс: <b>${userBalance.toFixed(2)} монет</b>`;
    }

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
            messageText += `\n\n⚠️ <b>Недостаточно средств!</b>\nДля генерации требуется ${cost.toFixed(2)} монет.\nВаш баланс: <b>${userBalance.toFixed(2)}</b> монет.`;
        }
    } else {
        // Not ready (Waiting for input)
        keyboard.text('✨ Отмена', 'cancel_generation').row();
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
    // 1. Time Check (5 minutes expiration)
    const now = Date.now();
    const created = latest.createdAt || 0; // fallback for existing sessions
    if (now - created > 5 * 60 * 1000) {
        console.log('[GENERATE] Latest state expired (time), ignoring.');
        return undefined;
    }

    // 2. Message Gap Check
    // If the gap between current message and menu is too large, assume context lost.
    // ctx.message?.message_id might be undefined if not available, but usually is.
    if (ctx.message?.message_id && latest.uiMessageId) {
        const gap = ctx.message.message_id - latest.uiMessageId;
        if (gap > 20) {
            console.log('[GENERATE] Latest state expired (gap), ignoring.');
            return undefined; // Too old, start new
        }
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
        totalGenerated: u.totalGenerated || 0,
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
    // 1. Prepare Status Message
    // Выбираем случайную фразу
    const randomPhrase = GENERATION_PHRASES[Math.floor(Math.random() * GENERATION_PHRASES.length)];

    // Проверяем, первый ли раз (или малый опыт) - показываем полную инструкцию
    // "показывай только первый раз полностью (потом сократи за двух слов)"
    const isFirstTime = user.totalGenerated === 0;
    const suffix = isFirstTime
        ? 'Как только ваше творчество испечётся, я сразу пришлю его вам! (Обычно 5-10 секунд)'
        : 'Ожидайте результат...';

    const startingText = `🚀 <b>${randomPhrase}</b>\n\n${suffix}`;

    // We wait to send this until AFTER queueing is successful

    try {
        // 2. Perform Generation (Queueing)
        let generationType: 'TEXT_TO_IMAGE' | 'IMAGE_TO_IMAGE' = GenerationMode.TEXT_TO_IMAGE === mode ? 'TEXT_TO_IMAGE' : 'IMAGE_TO_IMAGE';

        const inputImagesPayload: Array<{ buffer: Buffer; mimeType: string; fileId?: string }> = [];

        if (mode === GenerationMode.IMAGE_TO_IMAGE) {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const limit = user.settings?.selectedModel?.inputImagesLimit || 5;
            const filesToProcess = inputImageFileIds.slice(0, limit);

            // 1. Создание массива Промисов для всех операций I/O
            const downloadPromises = filesToProcess
                .filter(fileId => !!fileId) // Убеждаемся, что fileId существует
                .map(fileId => (async () => {
                    try {
                        // Получение пути к файлу
                        const file = await ctx.api.getFile(fileId);
                        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

                        // Скачивание файла
                        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                        const buffer = Buffer.from(response.data);

                        return {
                            buffer,
                            mimeType: 'image/jpeg',
                            fileId
                        };
                    } catch (e) {
                        console.error('Failed to download image', fileId, e);
                        return null; // Возвращаем null при ошибке, чтобы Promise.all не упал
                    }
                })());

            // 2. Асинхронное выполнение всех Промисов параллельно
            const results = await Promise.all(downloadPromises); // <-- 🚀 ПАРАЛЛЕЛЬНОЕ выполнение

            // 3. Фильтрация успешных результатов
            results.forEach(res => {
                if (res) {
                    inputImagesPayload.push(res);
                }
            });
        }

        await ctx.generationService.queueGeneration({
            userId: user.id,
            chatId: ctx.chat!.id,
            prompt,
            mode: generationType,
            inputImages: inputImagesPayload,
            aspectRatio: currentRatio,
            modelName: (user.settings as any)?.selectedModelId || user.settings?.model
        });

        // 3. Status SENT HERE (After queueing)
        await ctx.reply(startingText, { reply_markup: getMainKeyboard(), parse_mode: 'HTML' });

    } catch (error: any) {
        // If error happened before queueing, we simply report it.
        // No outdated message to delete because we didn't send success message yet.
        await ctx.reply(`❌ Ошибка постановки в очередь:\n${error.message || 'Неизвестная ошибка'}`, { reply_markup: getMainKeyboard() });
    }
}