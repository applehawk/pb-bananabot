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

                // Проверка на команды выхода
                if (text === '/start' || text === '/reset' || Object.values(KeyboardCommands).includes(text as any)) {
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

/**
 * ИСПРАВЛЕННАЯ ФУНКЦИЯ REGENERATION
 * Выполняет все запросы к БД в одном внешнем блоке, чтобы избежать DataCloneError
 */
/**
 * ИСПРАВЛЕННАЯ ФУНКЦИЯ REGENERATION
 * Использует строгую "плоскую" структуру возврата, чтобы избежать DataCloneError
 */
async function handleRegeneration(conversation: any, generationId: string) {

    // Получаем данные в "плоском" виде (только примитивы)
    const flatData = await conversation.external(async (exCtx: any) => {
        const dbUser = await exCtx.userService.findByTelegramId(exCtx.from?.id);
        if (!dbUser) return null;

        const gen = await exCtx.generationService.getById(generationId);
        if (!gen) return null;

        const u = dbUser as any;
        const inputImageFileIds = Array.isArray(gen.inputImages)
            ? gen.inputImages.map((i: any) => String(i.fileId)).filter(Boolean)
            : [];

        const mode = (gen.type === 'IMAGE_TO_IMAGE' || gen.type === 'MULTI_IMAGE') ? 'image' : 'text';
        const imgCount = inputImageFileIds.length;

        // Расчет стоимости
        let cost = 0;
        if (mode === 'text') {
            cost = exCtx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
        } else {
            const type = imgCount > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';
            cost = exCtx.creditsService.calculateCost(type, imgCount, 1);
        }

        // ВОЗВРАЩАЕМ ТОЛЬКО ПРИМИТИВЫ. Никаких вложенных объектов DB.
        return {
            userId: String(u.id),
            credits: Number(u.credits),
            settingsAspectRatio: u.settings ? String(u.settings.aspectRatio) : undefined,
            genPrompt: String(gen.prompt),
            genAspectRatio: String(gen.aspectRatio),
            genMode: String(mode),
            genInputImageFileIds: inputImageFileIds,
            cost: Number(cost),
            chatId: Number(exCtx.chat?.id ?? 0)
        };
    });

    if (!flatData) {
        return conversation.external(async (c: any) => {
            await c.reply('❌ Генерация не найдена или ошибка пользователя');
            return null;
        });
    }

    // Восстанавливаем объекты локально
    const user: SafeUser = {
        id: flatData.userId,
        credits: flatData.credits,
        settings: flatData.settingsAspectRatio ? { aspectRatio: flatData.settingsAspectRatio } : undefined
    };

    if (user.credits < flatData.cost) {
        return conversation.external(async (c: any) => {
            await c.reply('❌ Недостаточно кредитов');
            return null;
        });
    }

    await conversation.external(async (c: any) => {
        await c.reply('🔄 Повторная генерация...');
        return null;
    });

    await performGeneration(
        conversation,
        flatData.chatId,
        user,
        flatData.genPrompt,
        flatData.genMode as GenerationMode,
        flatData.genInputImageFileIds,
        flatData.genAspectRatio,
        flatData.cost
    );
}

// ... импорты остаются прежними ...

// Интерфейс для результата генерации (только примитивы!)
interface GenerationResult {
    id: string;
    processingTime: number;
    imageUrl?: string | null;
    fileId?: string | null;
    imageDataBase64?: string | null; // Передаем картинку как base64 строку, а не Buffer
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
    // 1. Отправляем сообщение о статусе
    const statusMsg = await conversation.external(async (ctx: any) => {
        const m = await ctx.reply(
            `🎨 Генерирую...\n⏱ 5-10 секунд\n\n"${prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}"`
        );
        return { chatId: m.chat.id, messageId: m.message_id };
    });

    try {
        // 2. Выполняем генерацию внутри ОДНОГО блока external
        // Это предотвращает сохранение тяжелых буферов картинок в историю разговора
        // и гарантирует возврат чистого объекта.
        const result: GenerationResult = await conversation.external(async (ctx: any) => {
            let gen: any;

            if (mode === 'text') {
                gen = await ctx.generationService.generateTextToImage({
                    userId: user.id,
                    prompt,
                    aspectRatio: currentRatio,
                });
            } else {
                // Логика скачивания и подготовки картинок перенесена ВНУТРЬ external
                const imageBuffers: Array<{ buffer: Buffer; mimeType: string; fileId?: string }> = [];
                const token = process.env.TELEGRAM_BOT_TOKEN;

                for (const fileId of inputImageFileIds) {
                    if (!fileId) continue;

                    // Используем ctx.api прямо здесь, без вложенных external
                    const file = await ctx.api.getFile(fileId);
                    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

                    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(response.data);

                    imageBuffers.push({
                        buffer,
                        mimeType: 'image/jpeg',
                        fileId
                    });
                }

                gen = await ctx.generationService.generateImageToImage({
                    userId: user.id,
                    prompt,
                    inputImages: imageBuffers,
                    aspectRatio: currentRatio,
                });
            }

            // ВАЖНО: Возвращаем "чистый" объект (DTO), а не объект Prisma.
            // Если imageData (Buffer) существует, конвертируем в base64 строку для безопасной передачи.
            return {
                id: String(gen.id),
                processingTime: Number(gen.processingTime),
                imageUrl: gen.imageUrl ? String(gen.imageUrl) : null,
                fileId: gen.fileId ? String(gen.fileId) : null,
                imageDataBase64: gen.imageData ? gen.imageData.toString('base64') : null
            };
        });

        // 3. Удаляем сообщение о статусе
        await deleteUiMessage(conversation, statusMsg);

        // 4. Формируем ответ
        const caption =
            `🎨 ${prompt}\n\n` +
            `💎 Использовано: ${cost} кр.\n` +
            `💰 Осталось: ${user.credits - cost} кр.\n` +
            `⏱ ${(result.processingTime / 1000).toFixed(1)}с`;

        const keyboard = {
            inline_keyboard: [[
                { text: '🔄 Вариация', callback_data: `regenerate_${result.id}` },
                { text: '📜 История', callback_data: 'history' }
            ]]
        };

        // 5. Отправляем результат (imageSource может быть URL, File ID или Buffer)
        await conversation.external(async (ctx: any) => {
            const source = result.fileId || result.imageUrl;

            if (source) {
                await ctx.replyWithPhoto(source, { caption, reply_markup: keyboard });
            } else if (result.imageDataBase64) {
                // Конвертируем обратно из base64 в Buffer для отправки
                const buffer = Buffer.from(result.imageDataBase64, 'base64');
                await ctx.replyWithPhoto(new InputFile(buffer), { caption, reply_markup: keyboard });
            } else {
                await ctx.reply(`✅ Генерация ID: ${result.id} завершена, но нет изображения для отображения.`);
            }
            return null;
        });

    } catch (error: any) {
        await deleteUiMessage(conversation, statusMsg);
        await conversation.external(async (ctx: any) => {
            await ctx.reply(`❌ Ошибка генерации:\n${error.message || 'Неизвестная ошибка'}`);
            return null;
        });
    }
}