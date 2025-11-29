import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands } from '../grammy/keyboards/main.keyboard';
import axios from 'axios';

type GenerationMode = 'text' | 'image';

/**
 * GENERATE Conversation
 *
 * Handles text-to-image and image-to-image generation.
 * This conversation is short-lived: it handles one generation request and then exits.
 */
export async function generateConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext,
) {
    try {
        console.log('[GENERATE] Conversation started');

        let prompt = '';
        let mode: GenerationMode = 'text';
        let inputImageFileIds: string[] = []; // Support multiple images from albums
        let isSelectingMode = false;

        // 1. Initialize state from the trigger message
        // Check the trigger message
        if (ctx.message) {
            const text = ctx.message.text;
            const caption = ctx.message.caption;
            const photo = ctx.message.photo;

            // Check for Photo
            if (photo && photo.length > 0) {
                mode = 'image';
                inputImageFileIds.push(photo[photo.length - 1].file_id);
                if (caption) prompt = caption.trim();
            }
            // Check for Text
            else if (text) {
                const extractedPrompt = text.replace(/^\/generate\s*/, '').trim();
                if (extractedPrompt && extractedPrompt !== '/generate') {
                    prompt = extractedPrompt;
                }
            }
        } else if (ctx.callbackQuery?.data?.startsWith('regenerate_')) {
            // Handle regeneration trigger immediately
            const generationId = ctx.callbackQuery.data.split('_')[1];
            await handleRegeneration(conversation, ctx, generationId);
            return; // Exit after regeneration
        }

        // 2. Interactive UI Loop
        // If we don't have a prompt yet (e.g. entered via command without args), we wait for it.
        // Or if we have prompt but need to confirm settings.

        let user: any = null;
        let cost = 0;

        const refreshUser = async () => {
            await conversation.external(async (exCtx) => {
                const telegramId = exCtx.from?.id;
                if (telegramId) {
                    user = await exCtx.userService.findByTelegramId(telegramId);
                    if (user) {
                        if (mode === 'text') {
                            cost = exCtx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
                        } else {
                            const numImages = inputImageFileIds.length;
                            const type = numImages > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';
                            cost = exCtx.creditsService.calculateCost(type, numImages, 1);
                        }
                    }
                }
            });
        };

        await refreshUser();
        let currentRatio = user?.settings?.aspectRatio || '1:1';

        // Helper to build UI
        const buildUI = () => {
            const canGenerate = user && user.credits >= cost;
            const keyboard = new InlineKeyboard();

            if (isSelectingMode) {
                keyboard.text(mode === 'text' ? '✅ Текст' : 'Текст', 'mode_text');
                keyboard.text(mode === 'image' ? '✅ Изображение+Текст' : 'Изображение+Текст', 'mode_image');
                keyboard.row();
                keyboard.text('🔙 Назад', 'mode_back');

                return {
                    text: '⚙️ <b>Выберите режим генерации:</b>\n\n' +
                        '<b>Текст:</b> Генерация изображения по текстовому описанию.\n' +
                        '<b>Изображение+Текст:</b> Генерация на основе вашего изображения и текста.',
                    keyboard
                };
            }

            let messageText = '';
            if (mode === 'text') {
                if (prompt) {
                    messageText = `ваш запрос: <b>${prompt}</b>`;
                } else {
                    messageText = `✍️ Напиши описание для генерации картинки и отправь его!`;
                }
            } else {
                if (inputImageFileIds.length > 0) {
                    messageText += `✅ Изображений загружено: ${inputImageFileIds.length}\n`;
                } else {
                    messageText += `📥 <b>Отправьте изображение или альбом</b> для обработки.\n`;
                }
                if (prompt) {
                    messageText += `📝 Ваш запрос: <b>${prompt}</b>\n`;
                } else {
                    messageText += `✍️ <b>Напиши описание</b> изменений или стиля.\n`;
                }
            }

            const readyToGenerate = mode === 'text' ? !!prompt : (!!prompt && inputImageFileIds.length > 0);

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
                } else {
                    keyboard.text('💳 Купить кредиты', 'buy_credits').row();
                }
            }
            keyboard.row();
            keyboard.text('⚙️ Режим', 'set_mode');

            if (readyToGenerate) {
                if (!canGenerate) {
                    messageText += `\n\n⚠️ <b>Недостаточно кредитов!</b>\nДля генерации требуется ${cost} кредитов.`;
                } else {
                    messageText += `\n\nНажмите кнопку ниже, чтобы начать.`;
                }
            }

            return { text: messageText, keyboard };
        };

        const initialUI = buildUI();
        const msgMeta = await conversation.external(async (externalCtx) => {
            const m = await externalCtx.reply(initialUI.text, { reply_markup: initialUI.keyboard, parse_mode: 'HTML' });
            return { chatId: m.chat?.id ?? ctx.chat?.id, messageId: m.message_id ?? undefined };
        });

        // Interaction Loop
        // let pendingWaitPromise: Promise<MyContext> | null | undefined = null;

        while (true) {
            console.log('[GENERATE] Waiting for input...');

            let ctx2 = await conversation.waitFor(['message:text', 'message:photo', 'callback_query:data']) as MyContext;

            console.log('[GENERATE] Received input:', ctx2.callbackQuery?.data || ctx2.message?.text);

            // Handle Callbacks
            if (ctx2.callbackQuery?.data) {
                const data = ctx2.callbackQuery.data;
                const callbackId = ctx2.callbackQuery.id;

                if (data === 'set_mode') {
                    isSelectingMode = true;
                    const ui = buildUI();
                    if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }
                if (data === 'mode_text') {
                    mode = 'text'; isSelectingMode = false;
                    await refreshUser();
                    const ui = buildUI();
                    if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }
                if (data === 'mode_image') {
                    mode = 'image'; isSelectingMode = false;
                    await refreshUser();
                    const ui = buildUI();
                    if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }
                if (data === 'mode_back') {
                    isSelectingMode = false;
                    const ui = buildUI();
                    if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }
                if (data.startsWith('regenerate_')) {
                    const generationId = data.split('_')[1];
                    await handleRegeneration(conversation, ctx, generationId);
                    // Delete UI
                    await conversation.external(async (externalCtx) => {
                        try {
                            if (msgMeta?.messageId) {
                                await externalCtx.api.deleteMessage(msgMeta.chatId, msgMeta.messageId);
                            }
                        } catch { }
                    });
                    return; // Exit
                }
                if (data.startsWith('aspect_')) {
                    const selected = data.split('_')[1];
                    currentRatio = selected;
                    if (user) {
                        user.settings = { ...(user.settings || {}), aspectRatio: selected };
                        await conversation.external(async (externalCtx) => {
                            await externalCtx.userService.updateSettings(user.id, { aspectRatio: selected });
                        });
                    }
                    await refreshUser();
                    const ui = buildUI();
                    if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui, callbackId);
                    continue;
                }
                if (data === 'generate_trigger') {
                    if (!prompt) {
                        await answerCallback(conversation, callbackId, '❌ Сначала введите описание!');
                        continue;
                    }
                    if (mode === 'image' && inputImageFileIds.length === 0) {
                        await answerCallback(conversation, callbackId, '❌ Сначала загрузите изображение!');
                        continue;
                    }
                    await refreshUser();
                    if (!user || user.credits < cost) {
                        await answerCallback(conversation, callbackId, '❌ Недостаточно кредитов!', true);
                        const ui = buildUI();
                        if (msgMeta?.messageId) await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                        continue;
                    }
                    // Proceed to generation
                    await answerCallback(conversation, callbackId);
                    await conversation.external(async (externalCtx) => {
                        try { if (msgMeta?.messageId) await externalCtx.api.deleteMessage(msgMeta.chatId, msgMeta.messageId); } catch { }
                    });
                    break; // Break loop to generate
                }
                if (data === 'buy_credits') {
                    await answerCallback(conversation, callbackId);
                    ctx.session.quickBuy = true;
                    await conversation.external(async (externalCtx) => {
                        try { if (msgMeta?.messageId) await externalCtx.api.deleteMessage(msgMeta.chatId, msgMeta.messageId); } catch { }
                    });
                    await ctx.conversation.enter('buy_credits');
                    return;
                }
            }

            const text = ctx2.message?.text;
            const caption = ctx2.message?.caption;
            const photo = ctx2.message?.photo;

            // Handle Photo (append to existing images)
            if (photo && photo.length > 0) {
                mode = 'image';
                const newFileId = photo[photo.length - 1].file_id;

                // Avoid duplicates if the same file is sent (though file_ids might differ slightly, usually safe to just add)
                if (!inputImageFileIds.includes(newFileId)) {
                    inputImageFileIds.push(newFileId);
                }

                if (caption) prompt = caption.trim();

                // Removed message deletion to keep the album visible in chat
                // await conversation.external(async (externalCtx) => {
                //     try { await externalCtx.api.deleteMessage(ctx2.chat.id, ctx2.message!.message_id); } catch { }
                // });

                await refreshUser();
                const ui = buildUI();
                if (msgMeta?.messageId) {
                    await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                }
                continue;
            }

            // Handle Text
            else if (text) {
                const incomingText = ctx2.message.text;
                const keyboardButtonValues = Object.values(KeyboardCommands);
                if (keyboardButtonValues.includes(incomingText as any)) {
                    // User pressed main keyboard button - exit conversation to let global handler take over
                    if (msgMeta?.messageId) {
                        await conversation.external(async (externalCtx) => {
                            await externalCtx.api.deleteMessage(msgMeta.chatId, msgMeta.messageId);
                        });
                        return;
                    }

                    prompt = incomingText;

                    await conversation.external(async (externalCtx) => {
                        try {
                            await externalCtx.api.deleteMessage(ctx2.chat.id, ctx2.message!.message_id);
                        } catch {
                            console.log('Failed to delete message');
                        };
                    });

                    await refreshUser();
                    const ui = buildUI();
                    if (msgMeta?.messageId) {
                        await updateUI(conversation, msgMeta.chatId, msgMeta.messageId, ui);
                    }
                    continue;
                }

            }
        }

        // Generation Logic
        await performGeneration(conversation, ctx, user, prompt, mode, inputImageFileIds, currentRatio, cost);
    } catch (error: any) {
        await conversation.external(async (externalCtx) => {
            console.error('[GENERATE] Conversation CRASHED:', error);
            await externalCtx.reply('❌ Произошла ошибка в разговоре. Пожалуйста, попробуйте снова /start');
        });
    }
}

// --- Helpers ---

async function updateUI(conversation: any, chatId: number, messageId: number, ui: any, callbackId?: string) {
    await conversation.external(async (externalCtx: any) => {
        // 1. Answer callback first to stop loading animation
        if (callbackId) {
            try {
                await externalCtx.api.answerCallbackQuery(callbackId);
            } catch (e) {
                console.error('Error answering callback:', e);
            }
        }

        // 2. Edit message
        try {
            await externalCtx.api.editMessageText(chatId, messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'HTML' });
        } catch (e) {
            const msg = String(e);
            if (!msg.includes('message is not modified')) {
                console.error('Error editing message:', e);
            }
        }
    });
}

async function answerCallback(conversation: any, callbackId: string, text?: string, alert = false) {
    await conversation.external(async (externalCtx: any) => {
        try {
            await externalCtx.api.answerCallbackQuery(callbackId, { text, show_alert: alert });
        } catch { }
    });
}

async function handleRegeneration(conversation: any, ctx: any, generationId: string) {
    const originalGeneration = await conversation.external(async (externalCtx: any) => {
        const gen = await externalCtx.generationService.getById(generationId);
        if (!gen) return null;
        // Return only serializable data
        return {
            prompt: gen.prompt,
            aspectRatio: gen.aspectRatio,
            type: gen.type,
            inputImages: gen.inputImages ? gen.inputImages.map((i: any) => ({ fileId: i.fileId })) : []
        };
    });

    if (!originalGeneration) {
        await conversation.external(async (ext: any) => ext.reply('❌ Генерация не найдена'));
        return;
    }

    const prompt = originalGeneration.prompt;
    const currentRatio = originalGeneration.aspectRatio;
    let mode: GenerationMode = 'text';
    let inputImageFileIds: string[] = [];

    if (originalGeneration.type === 'IMAGE_TO_IMAGE' || originalGeneration.type === 'MULTI_IMAGE') {
        mode = 'image';
        if (originalGeneration.inputImages && originalGeneration.inputImages.length > 0) {
            inputImageFileIds = originalGeneration.inputImages.map((img: any) => img.fileId);
        }
        if (inputImageFileIds.length > 0 && inputImageFileIds.some(fid => !fid)) {
            await conversation.external(async (ext: any) => ext.reply('❌ Невозможно выполнить регенерацию: исходные файлы недоступны (отсутствует file_id).'));
            return;
        }
    }

    const { user, cost } = await conversation.external(async (exCtx: any) => {
        const telegramId = exCtx.from?.id;
        if (!telegramId) return { user: null, cost: 0 };

        const u = await exCtx.userService.findByTelegramId(telegramId);
        if (!u) return { user: null, cost: 0 };

        let c = 0;
        if (mode === 'text') {
            c = exCtx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
        } else {
            const numImages = inputImageFileIds.length;
            const type = numImages > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';
            c = exCtx.creditsService.calculateCost(type, numImages, 1);
        }

        // Return serializable user subset
        return {
            user: { id: u.id, credits: u.credits },
            cost: c
        };
    });

    if (!user || user.credits < cost) {
        await conversation.external(async (ext: any) => ext.reply('❌ Недостаточно кредитов'));
        return;
    }

    await conversation.external(async (ext: any) => ext.reply('🔄 Повторная генерация...'));
    await performGeneration(conversation, ctx, user, prompt, mode, inputImageFileIds, currentRatio, cost);
}

async function performGeneration(
    conversation: any,
    ctx: any,
    user: any,
    prompt: string,
    mode: GenerationMode,
    inputImageFileIds: string[],
    currentRatio: string,
    cost: number
) {
    const statusMsg = await conversation.external(async (externalCtx: any) => {
        const m = await externalCtx.reply(
            `🎨 Генерирую изображение...\n⏱ Подождите 5-10 секунд\n\n` +
            `Промпт: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
        );
        return { chatId: m.chat?.id ?? ctx.chat?.id, messageId: m.message_id ?? undefined };
    });

    try {
        let generation: any = null;

        if (mode === 'text') {
            await conversation.external(async (exCtx: any) => {
                try {
                    generation = await exCtx.generationService.generateTextToImage({
                        userId: user.id,
                        prompt,
                        aspectRatio: currentRatio,
                    });
                } catch (err: any) {
                    throw new Error(err.message || 'Text-to-image generation failed');
                }
            });
        } else {
            const imageBuffers: Array<{ buffer: Buffer; mimeType: string; fileId?: string }> = [];
            const token = process.env.TELEGRAM_BOT_TOKEN;

            for (const fileId of inputImageFileIds) {
                const file = await conversation.external(async (externalCtx: any) => {
                    return await externalCtx.api.getFile(fileId);
                });
                const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

                const imageBufferData = await conversation.external(async () => {
                    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                    return response.data;
                });
                const imageBuffer = Buffer.from(imageBufferData);
                imageBuffers.push({ buffer: imageBuffer, mimeType: 'image/jpeg', fileId: fileId });
            }

            await conversation.external(async (exCtx: any) => {
                try {
                    generation = await exCtx.generationService.generateImageToImage({
                        userId: user.id,
                        prompt,
                        inputImages: imageBuffers,
                        aspectRatio: currentRatio,
                    });
                } catch (err: any) {
                    throw new Error(err.message || 'Image-to-image generation failed');
                }
            });
        }


        if (statusMsg?.chatId && statusMsg?.messageId) {
            await conversation.external(async (externalCtx: any) => {
                try { await externalCtx.api.deleteMessage(statusMsg.chatId, statusMsg.messageId); } catch { }
            });
        }

        const caption =
            `🎨 ${prompt}\n\n` +
            `💎 Использовано: ${cost} кредитов\n` +
            `💰 Осталось: ${user.credits - cost} кредитов\n` +
            `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

        const imageSource = generation.fileId || generation.imageUrl;

        if (imageSource) {
            await conversation.external(async (externalCtx: any) => {
                try {
                    await externalCtx.replyWithPhoto(imageSource, {
                        caption,
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '🔄 Вариация', callback_data: `regenerate_${generation.id}` },
                                    { text: '⚙️ Параметры', callback_data: 'settings' },
                                ],
                                [{ text: '📜 История', callback_data: 'history' }],
                            ],
                        },
                    });
                } catch { }
            });
        } else if (generation.imageData) {
            const buffer = Buffer.from(generation.imageData, 'base64');
            await conversation.external(async (externalCtx: any) => {
                try {
                    await externalCtx.replyWithPhoto(new InputFile(buffer), {
                        caption,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Вариация', callback_data: `regenerate_${generation.id}` }],
                            ],
                        },
                    });
                } catch { }
            });
        } else {
            await conversation.external(async (externalCtx: any) => {
                try {
                    await externalCtx.reply(`✅ Изображение сгенерировано, но произошла ошибка при отправке.\nGeneration ID: ${generation.id}`);
                } catch { }
            });
        }
    } catch (error: any) {
        await conversation.external(async (externalCtx: any) => {
            try { await externalCtx.api.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch { }
        });
        await conversation.external(async (externalCtx: any) => {
            try {
                await externalCtx.reply(
                    `❌ Ошибка при генерации изображения\n\n${error?.message ?? String(error)}\n\nПопробуйте:\n• Изменить промпт\n• Попробовать позже\n• Использовать /help для справки`,
                );
            } catch { }
        });
    }
}
