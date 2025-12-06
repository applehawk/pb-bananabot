import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '3:4', '4:3'];

export async function settingsConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext,
) {
    try {
        const telegramId = ctx.from?.id;
        if (!telegramId) return;

        // Получаем пользователя (безопасный объект)
        const user = await conversation.external(async (exCtx) => {
            const u = await exCtx.userService.findByTelegramId(telegramId);
            if (u) {
                // FIX: Приведение к any для доступа к settings
                const uAny = u as any;
                return { id: u.id, settings: uAny.settings };
            }
            return null;
        });

        if (!user) {
            await ctx.reply('❌ Пользователь не найден. Введите /start');
            return;
        }

        let currentRatio = user.settings?.aspectRatio || '1:1';
        let isHdQuality = user.settings?.hdQuality || false;
        let selectedModelId = user.settings?.selectedModelId || 'gemini-2.5-flash-image';

        const buildSettingsUI = () => {
            const keyboard = new InlineKeyboard();
            ASPECT_RATIOS.forEach((r, i) => {
                keyboard.text(r === currentRatio ? `✅ ${r}` : r, `aspect_${r}`);
                if ((i + 1) % 3 === 0) keyboard.row();
            });
            if (ASPECT_RATIOS.length % 3 !== 0) keyboard.row();

            // HD Quality Toggle
            const hdText = isHdQuality ? '✅ 💎 HD (4K)' : '⬜️ 💎 HD (2K)';
            keyboard.text(hdText, 'toggle_hd').row();

            // Model Toggle
            const isPro = selectedModelId === 'gemini-3-pro-image-preview';
            const modelText = isPro ? '✅ 🤖 Модель: Продвинутая' : '⬜️ 🤖 Модель: Простая';
            keyboard.text(modelText, 'toggle_model').row();

            keyboard.text('✅ Сохранить', 'save_settings').row();
            keyboard.text('🔙 Назад', 'close_settings');

            const modelDesc = isPro
                ? 'Продвинутая (Gemini 3.0 Pro) (~16 руб/шт)'
                : 'Простая (Gemini 2.5 Flash) (~5 руб/шт)';

            return {
                text: `⚙️ **Настройки**\n\n📐 **Соотношение сторон:** ${currentRatio}\n💎 **Качество:** ${isHdQuality ? '4K (HD)' : '2K (Standard)'}\n🤖 **Модель:** ${modelDesc}\n\nВыберите параметры:`,
                keyboard
            };
        };

        const initialUI = buildSettingsUI();
        const msgMeta = await conversation.external(async (ext) => {
            const m = await ext.reply(initialUI.text, { reply_markup: initialUI.keyboard, parse_mode: 'Markdown' });
            return { chatId: m.chat.id, messageId: m.message_id };
        });

        // Loop
        while (true) {
            const ctx2 = await conversation.waitFor(['callback_query:data', 'message:text']);

            // Проверка на команды выхода
            if (ctx2.message?.text) {
                const text = ctx2.message.text;
                if (text === '/start' || text === '/reset') {
                    await conversation.external(async (ext) => {
                        try { await ext.api.deleteMessage(msgMeta.chatId, msgMeta.messageId); } catch (e) { console.error('[SETTINGS] Failed to delete message:', e); }
                    });
                    return;
                }
            }

            const data = ctx2.callbackQuery?.data;
            const callbackId = ctx2.callbackQuery?.id;
            if (!data || !callbackId) continue;

            if (data.startsWith('aspect_')) {
                currentRatio = data.split('_')[1];
                await conversation.external(async (ext) => {
                    try { await ext.api.answerCallbackQuery(callbackId); } catch (e) { console.error('[SETTINGS] Failed to answer callback:', e); }
                    return null;
                });

                const ui = buildSettingsUI();
                await conversation.external(async (ext) => {
                    try {
                        await ext.api.editMessageText(msgMeta.chatId, msgMeta.messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'Markdown' });
                    } catch (e) { console.error('[SETTINGS] Failed to edit message:', e); }
                    return null;
                });
                continue;
            }

            if (data === 'toggle_hd') {
                isHdQuality = !isHdQuality;
                await conversation.external(async (ext) => {
                    try { await ext.api.answerCallbackQuery(callbackId); } catch (e) { console.error('[SETTINGS] Failed to answer callback:', e); }
                    return null;
                });

                const ui = buildSettingsUI();
                await conversation.external(async (ext) => {
                    try {
                        await ext.api.editMessageText(msgMeta.chatId, msgMeta.messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'Markdown' });
                    } catch (e) { console.error('[SETTINGS] Failed to edit message:', e); }
                    return null;
                });
                continue;
            }

            if (data === 'toggle_model') {
                selectedModelId = selectedModelId === 'gemini-2.5-flash-image'
                    ? 'gemini-3-pro-image-preview'
                    : 'gemini-2.5-flash-image';

                await conversation.external(async (ext) => {
                    try { await ext.api.answerCallbackQuery(callbackId); } catch (e) { console.error('[SETTINGS] Failed to answer callback:', e); }
                    return null;
                });

                const ui = buildSettingsUI();
                await conversation.external(async (ext) => {
                    try {
                        await ext.api.editMessageText(msgMeta.chatId, msgMeta.messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'Markdown' });
                    } catch (e) { console.error('[SETTINGS] Failed to edit message:', e); }
                    return null;
                });
                continue;
            }

            if (data === 'save_settings') {
                await conversation.external(async (ext) => {
                    await ext.userService.updateSettings(user!.id, {
                        aspectRatio: currentRatio,
                        hdQuality: isHdQuality,
                        selectedModelId: selectedModelId
                    });
                    try { await ext.api.answerCallbackQuery(callbackId, { text: '✅ Настройки сохранены!' }); } catch (e) { console.error('[SETTINGS] Failed to answer callback with text:', e); }
                    try { await ext.api.deleteMessage(msgMeta.chatId, msgMeta.messageId); } catch (e) { console.error('[SETTINGS] Failed to delete message:', e); }

                    const modelName = selectedModelId === 'gemini-3-pro-image-preview' ? 'Продвинутая' : 'Простая';
                    await ext.reply(`✅ Настройки сохранены!\n📐 Формат: **${currentRatio}**\n💎 Качество: **${isHdQuality ? '4K' : '2K'}**\n🤖 Модель: **${modelName}**`, { parse_mode: 'Markdown' });
                    return null;
                });
                return;
            }

            if (data === 'close_settings') {
                await conversation.external(async (ext) => {
                    try { await ext.api.answerCallbackQuery(callbackId); } catch (e) { console.error('[SETTINGS] Failed to answer callback:', e); }
                    try { await ext.api.deleteMessage(msgMeta.chatId, msgMeta.messageId); } catch (e) { console.error('[SETTINGS] Failed to delete message:', e); }
                    return null;
                });
                return;
            }
        }
    } catch (error) {
        console.error('[SETTINGS] Error:', error);
    }
}