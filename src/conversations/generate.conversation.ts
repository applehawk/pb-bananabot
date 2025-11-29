import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands } from '../grammy/keyboards/main.keyboard';
import axios from 'axios';

type GenerationMode = 'text' | 'image';

interface ConversationState {
    prompt: string;
    mode: GenerationMode;
    inputImageFileIds: string[];
    skipAspectRatioSelection: boolean;
}

interface SafeUser {
    id: string;
    credits: number;
    settings?: { aspectRatio?: string };
}

/**
 * Вспомогательная функция: Извлекает начальное состояние из контекста запуска
 */
function extractInitialState(ctx: MyContext): ConversationState {
    let prompt = '';
    let mode: GenerationMode = 'text';
    const inputImageFileIds: string[] = [];
    let skipAspectRatioSelection = false;

    // 1. Проверка Reply (ответ на сообщение)
    if (ctx.message?.reply_to_message) {
        const replyMsg = ctx.message.reply_to_message;

        if (replyMsg.photo?.length) {
            mode = 'image';
            inputImageFileIds.push(replyMsg.photo[replyMsg.photo.length - 1].file_id);
        }

        prompt = (ctx.message.text || ctx.message.caption || replyMsg.caption || replyMsg.text || '').trim();
        skipAspectRatioSelection = true;
    }
    // 2. Проверка текущего сообщения
    else if (ctx.message) {
        const { text, caption, photo } = ctx.message;

        if (photo?.length) {
            mode = 'image';
            inputImageFileIds.push(photo[photo.length - 1].file_id);
            if (caption) prompt = caption.trim();
        } else if (text) {
            const extracted = text.replace(/^\/generate\s*/, '').trim();
            if (extracted && extracted !== '/generate') prompt = extracted;
        }
    }

    return { prompt, mode, inputImageFileIds, skipAspectRatioSelection };
}

/**
 * Вспомогательная функция: Строит UI (Текст + Клавиатура)
 */
function buildGenerateUI(
    mode: GenerationMode,
    prompt: string,
    imgCount: number,
    cost: number,
    canGenerate: boolean,
    currentRatio: string
) {
    const keyboard = new InlineKeyboard();
    let messageText = '';

    if (mode === 'text') {
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

    const readyToGenerate = mode === 'text' ? !!prompt : (!!prompt && imgCount > 0);

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

            messageText += `\n\nНажмите кнопку ниже, чтобы начать.`;
        } else {
            keyboard.text('💳 Купить кредиты', 'buy_credits').row();
            messageText += `\n\n⚠️ <b>Недостаточно кредитов!</b>\nДля генерации требуется ${cost} кредитов.`;
        }
    }

    return { text: messageText, keyboard };
}

export async function generateConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext,
) {
    try {
        console.log('[GENERATE] Conversation started');

        // Обработка быстрой регенерации
        if (ctx.callbackQuery?.data?.startsWith('regenerate_')) {
            const generationId = ctx.callbackQuery.data.split('_')[1];
            await handleRegeneration(conversation, generationId);
            return;
        }

        // Инициализация
        const state = extractInitialState(ctx);
        let user: SafeUser | null = null;
        let cost = 0;

        // Функция обновления данных пользователя и стоимости
        const refreshData = async () => {
            await conversation.external(async (exCtx) => {
                const telegramId = exCtx.from?.id;
                if (!telegramId) return;

                const dbUser = await exCtx.userService.findByTelegramId(telegramId);
                if (dbUser) {
                    const u = dbUser as any;
                    // Создаем POJO (Plain Old JavaScript Object) во избежание DataCloneError
                    user = {
                        id: u.id,
                        credits: u.credits,
                        settings: u.settings // Теперь безопасно
                    };

                    if (state.mode === 'text') {
                        cost = exCtx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
                    } else {
                        const count = state.inputImageFileIds.length;
                        const type = count > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';
                        cost = exCtx.creditsService.calculateCost(type, count, 1);
                    }
                }
            });
        };

        await refreshData();
        let currentRatio = user?.settings?.aspectRatio || '1:1';

        // Быстрый старт (если это Reply со всеми данными)
        if (state.skipAspectRatioSelection && state.prompt &&
            (state.mode === 'text' || state.inputImageFileIds.length > 0)) {
            await refreshData();
            if (user && user.credits >= cost) {
                await performGeneration(conversation, ctx.chat?.id ?? 0, user, state.prompt, state.mode, state.inputImageFileIds, currentRatio, cost);
                return;
            }
        }

        // Подготовка UI
        const originalChatId = ctx.chat?.id ?? 0;
        const initialUI = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, (user?.credits ?? 0) >= cost, currentRatio);

        const msgMeta = await conversation.external(async (externalCtx) => {
            const m = await externalCtx.reply(initialUI.text, { reply_markup: initialUI.keyboard, parse_mode: 'HTML' });
            return { chatId: m.chat?.id ?? originalChatId, messageId: m.message_id };
        });

        // --- Интерактивный цикл ---
        while (true) {
            const ctx2 = await conversation.waitFor(['message:text', 'message:photo', 'callback_query:data']) as MyContext;

            // Обработка Callback (кнопки)
            if (ctx2.callbackQuery?.data) {
                const data = ctx2.callbackQuery.data;
                const callbackId = ctx2.callbackQuery.id;

                if (data.startsWith('regenerate_')) {
                    const generationId = data.split('_')[1];
                    await handleRegeneration(conversation, generationId);
                    await deleteUiMessage(conversation, msgMeta);
                    return;
                }

                if (data.startsWith('aspect_')) {
                    currentRatio = data.split('_')[1];
                    if (user) {
                        await conversation.external(async (ext) => ext.userService.updateSettings(user!.id, { aspectRatio: currentRatio }));
                    }
                    await refreshData();
                    const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, (user?.credits ?? 0) >= cost, currentRatio);
                    if (msgMeta.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }

                if (data === 'generate_trigger') {
                    if (!state.prompt) {
                        await answerCallback(conversation, callbackId, '❌ Введите описание!');
                        continue;
                    }
                    if (state.mode === 'image' && state.inputImageFileIds.length === 0) {
                        await answerCallback(conversation, callbackId, '❌ Загрузите изображение!');
                        continue;
                    }

                    await refreshData();
                    if (!user || user.credits < cost) {
                        await answerCallback(conversation, callbackId, '❌ Недостаточно кредитов!', true);
                        const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, false, currentRatio);
                        if (msgMeta.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                        continue;
                    }

                    await answerCallback(conversation, callbackId);
                    await deleteUiMessage(conversation, msgMeta);
                    break; // ВЫХОД НА ГЕНЕРАЦИЮ
                }

                if (data === 'buy_credits') {
                    await answerCallback(conversation, callbackId);
                    ctx.session.quickBuy = true;
                    await deleteUiMessage(conversation, msgMeta);
                    await ctx.conversation.enter('buy_credits');
                    return;
                }
            }

            // Обработка Фото
            if (ctx2.message?.photo?.length) {
                state.mode = 'image';
                const newFileId = ctx2.message.photo[ctx2.message.photo.length - 1].file_id;
                if (!state.inputImageFileIds.includes(newFileId)) state.inputImageFileIds.push(newFileId);
                if (ctx2.message.caption) state.prompt = ctx2.message.caption.trim();

                await refreshData();
                const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, (user?.credits ?? 0) >= cost, currentRatio);
                if (msgMeta.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                continue;
            }

            // Обработка Текста
            if (ctx2.message?.text) {
                const text = ctx2.message.text;
                // Проверка на выход в меню
                if (Object.values(KeyboardCommands).includes(text as any)) {
                    await deleteUiMessage(conversation, msgMeta);
                    return;
                }

                state.prompt = text;
                await conversation.external(async (ext) => { try { await ext.api.deleteMessage(ctx2.chat.id, ctx2.message!.message_id); } catch { } });

                await refreshData();
                const ui = buildGenerateUI(state.mode, state.prompt, state.inputImageFileIds.length, cost, (user?.credits ?? 0) >= cost, currentRatio);
                if (msgMeta.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                continue;
            }
        }

        // Запуск генерации
        if (user) {
            await performGeneration(conversation, ctx.chat?.id ?? 0, user, state.prompt, state.mode, state.inputImageFileIds, currentRatio, cost);
        }

    } catch (error: any) {
        await conversation.external(async (externalCtx) => {
            console.error('[GENERATE] Conversation CRASHED:', error);
            await externalCtx.reply('❌ Произошла ошибка. Попробуйте /start');
        });
    }
}

// --- Helpers ---

async function deleteUiMessage(conversation: any, meta: { chatId: number, messageId?: number }) {
    if (meta.messageId) {
        await conversation.external(async (ctx: any) => {
            try { await ctx.api.deleteMessage(meta.chatId, meta.messageId); } catch { }
        });
    }
}

async function updateUI(conversation: any, chatId: number, messageId: number, ui: any, callbackId?: string) {
    await conversation.external(async (externalCtx: any) => {
        if (callbackId) try { await externalCtx.api.answerCallbackQuery(callbackId); } catch { }
        try {
            await externalCtx.api.editMessageText(chatId, messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
        } catch { }
    });
}

async function answerCallback(conversation: any, callbackId: string, text?: string, alert = false) {
    await conversation.external(async (ctx: any) => {
        try { await ctx.api.answerCallbackQuery(callbackId, { text, show_alert: alert }); } catch { }
    });
}

async function handleRegeneration(conversation: any, generationId: string) {
    const genData = await conversation.external(async (ext: any) => {
        const g = await ext.generationService.getById(generationId);
        if (!g) return null;
        return {
            prompt: g.prompt,
            aspectRatio: g.aspectRatio,
            type: g.type,
            inputImages: Array.isArray(g.inputImages) ? g.inputImages.map((i: any) => ({ fileId: i?.fileId })) : []
        };
    });

    if (!genData) return conversation.external((c: any) => c.reply('❌ Генерация не найдена'));

    const inputImageFileIds = genData.inputImages.map((i: any) => i.fileId).filter(Boolean);
    const mode: GenerationMode = (genData.type === 'IMAGE_TO_IMAGE' || genData.type === 'MULTI_IMAGE') ? 'image' : 'text';

    if (mode === 'image' && !inputImageFileIds.length) {
        return conversation.external((c: any) => c.reply('❌ Исходные файлы недоступны'));
    }

    // Capture primitives only
    const imgCount = inputImageFileIds.length;

    const { user, cost, chatId } = await conversation.external(async (exCtx: any) => {
        const u = await exCtx.userService.findByTelegramId(exCtx.from?.id);
        if (!u) return { user: null, cost: 0, chatId: 0 };

        let c = 0;
        if (mode === 'text') c = exCtx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
        else c = exCtx.creditsService.calculateCost(imgCount > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE', imgCount, 1);

        return { user: { id: u.id, credits: u.credits }, cost: c, chatId: exCtx.chat?.id ?? 0 };
    });

    if (!user || user.credits < cost) {
        return conversation.external((c: any) => c.reply('❌ Недостаточно кредитов'));
    }

    await conversation.external((c: any) => c.reply('🔄 Повторная генерация...'));
    await performGeneration(conversation, chatId, user, genData.prompt, mode, inputImageFileIds, genData.aspectRatio, cost);
}

async function performGeneration(
    conversation: any,
    chatId: number,
    user: SafeUser,
    prompt: string,
    mode: GenerationMode,
    inputImageFileIds: string[],
    currentRatio: string,
    cost: number
) {
    const statusMsg = await conversation.external(async (ctx: any) => {
        const m = await ctx.reply(`🎨 Генерирую...\n⏱ 5-10 секунд\n\n"${prompt.slice(0, 100)}..."`);
        return { chatId: m.chat.id, messageId: m.message_id };
    });

    try {
        let generation: any = null;

        if (mode === 'text') {
            await conversation.external(async (ctx: any) => {
                generation = await ctx.generationService.generateTextToImage({ userId: user.id, prompt, aspectRatio: currentRatio });
            });
        } else {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const imageBuffers = [];

            for (const fileId of inputImageFileIds) {
                if (!fileId) continue;
                const file = await conversation.external((ctx: any) => ctx.api.getFile(fileId));
                const bufferData = await conversation.external(async () => (await axios.get(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { responseType: 'arraybuffer' })).data);
                imageBuffers.push({ buffer: Buffer.from(bufferData), mimeType: 'image/jpeg', fileId });
            }

            await conversation.external(async (ctx: any) => {
                generation = await ctx.generationService.generateImageToImage({ userId: user.id, prompt, inputImages: imageBuffers, aspectRatio: currentRatio });
            });
        }

        await deleteUiMessage(conversation, statusMsg);

        const caption = `🎨 ${prompt}\n\n💎 -${cost} кр.\n💰 Баланс: ${user.credits - cost}\n⏱ ${(generation.processingTime / 1000).toFixed(1)}с`;
        const keyboard = { inline_keyboard: [[{ text: '🔄 Вариация', callback_data: `regenerate_${generation.id}` }, { text: '📜 История', callback_data: 'history' }]] };

        await conversation.external(async (ctx: any) => {
            const source = generation.fileId || generation.imageUrl;
            if (source) await ctx.replyWithPhoto(source, { caption, reply_markup: keyboard });
            else if (generation.imageData) await ctx.replyWithPhoto(new InputFile(Buffer.from(generation.imageData, 'base64')), { caption, reply_markup: keyboard });
        });

    } catch (error: any) {
        await deleteUiMessage(conversation, statusMsg);
        await conversation.external((ctx: any) => ctx.reply(`❌ Ошибка генерации:\n${error.message}`));
    }
}