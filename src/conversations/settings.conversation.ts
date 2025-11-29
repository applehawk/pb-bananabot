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
        let user: { id: string, settings?: { aspectRatio?: string } } | null = null;
        await conversation.external(async (exCtx) => {
            const u = await exCtx.userService.findByTelegramId(telegramId);
            if (u) {
                // FIX: Приведение к any для доступа к settings
                const uAny = u as any;
                user = { id: u.id, settings: uAny.settings };
            }
        });

        if (!user) {
            await ctx.reply('❌ Пользователь не найден. Введите /start');
            return;
        }

        let currentRatio = user.settings?.aspectRatio || '1:1';

        const buildSettingsUI = () => {
            const keyboard = new InlineKeyboard();
            ASPECT_RATIOS.forEach((r, i) => {
                keyboard.text(r === currentRatio ? `✅ ${r}` : r, `aspect_${r}`);
                if ((i + 1) % 3 === 0) keyboard.row();
            });
            if (ASPECT_RATIOS.length % 3 !== 0) keyboard.row();

            keyboard.text('✅ Сохранить', 'save_settings').row();
            keyboard.text('🔙 Назад', 'close_settings');

            return {
                text: `⚙️ **Настройки**\n\n📐 **Соотношение сторон:** ${currentRatio}\n\nВыберите формат:`,
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
            const ctx2 = await conversation.waitFor('callback_query:data');
            const data = ctx2.callbackQuery?.data;
            const callbackId = ctx2.callbackQuery?.id;
            if (!data || !callbackId) continue;

            if (data.startsWith('aspect_')) {
                currentRatio = data.split('_')[1];
                await conversation.external((ext) => ext.api.answerCallbackQuery(callbackId).catch(() => { }));

                const ui = buildSettingsUI();
                await conversation.external((ext) => ext.api.editMessageText(msgMeta.chatId, msgMeta.messageId, ui.text, { reply_markup: ui.keyboard, parse_mode: 'Markdown' }).catch(() => { }));
                continue;
            }

            if (data === 'save_settings') {
                await conversation.external(async (ext) => {
                    await ext.userService.updateSettings(user!.id, { aspectRatio: currentRatio });
                    await ext.api.answerCallbackQuery(callbackId, { text: '✅ Настройки сохранены!' }).catch(() => { });
                    await ext.api.deleteMessage(msgMeta.chatId, msgMeta.messageId).catch(() => { });
                    await ext.reply(`✅ Настройки сохранены!\n📐 Формат: **${currentRatio}**`, { parse_mode: 'Markdown' });
                });
                return;
            }

            if (data === 'close_settings') {
                await conversation.external(async (ext) => {
                    await ext.api.answerCallbackQuery(callbackId).catch(() => { });
                    await ext.api.deleteMessage(msgMeta.chatId, msgMeta.messageId).catch(() => { });
                });
                return;
            }
        }
    } catch (error) {
        console.error('[SETTINGS] Error:', error);
    }
}