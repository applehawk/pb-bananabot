import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';

/**
 * SETTINGS Conversation
 *
 * Allows users to configure their preferences, primarily aspect ratio
 */
export async function settingsConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext,
) {
    try {
        const telegramId = ctx.from?.id;
        if (!telegramId) {
            await ctx.reply('❌ Не удалось определить пользователя.');
            return;
        }

        // Get user settings
        let user: any = null;
        await conversation.external(async (exCtx) => {
            user = await exCtx.userService.findByTelegramId(telegramId);
        });

        if (!user) {
            await ctx.reply('❌ Пользователь не найден. Используйте /start для регистрации.');
            return;
        }

        let currentRatio = user?.settings?.aspectRatio || '1:1';

        // Build settings UI
        const buildUI = () => {
            const keyboard = new InlineKeyboard();
            const ratios = ['1:1', '16:9', '9:16', '3:4', '4:3'];

            ratios.forEach((r, i) => {
                const label = r === currentRatio ? `✅ ${r}` : r;
                keyboard.text(label, `aspect_${r}`);
                if ((i + 1) % 3 === 0) keyboard.row();
            });
            if (ratios.length % 3 !== 0) keyboard.row();

            keyboard.text('✅ Сохранить', 'save_settings').row();
            keyboard.text('🔙 Назад', 'close_settings');

            const message =
                `⚙️ **Настройки**\n\n` +
                `📐 **Соотношение сторон:** ${currentRatio}\n\n` +
                `Выберите предпочтительное соотношение сторон для генерации изображений:`;

            return { text: message, keyboard };
        };

        const initialUI = buildUI();
        const msgMeta = await conversation.external(async (externalCtx) => {
            const m = await externalCtx.reply(initialUI.text, {
                reply_markup: initialUI.keyboard,
                parse_mode: 'Markdown',
            });
            return {
                chatId: m.chat?.id ?? ctx.chat?.id,
                messageId: m.message_id ?? undefined,
            };
        });

        // Interaction loop
        while (true) {
            const ctx2 = await conversation.waitFor('callback_query:data');

            if (!ctx2.callbackQuery?.data) continue;

            const data = ctx2.callbackQuery.data;
            const callbackId = ctx2.callbackQuery.id;

            // Handle aspect ratio selection
            if (data.startsWith('aspect_')) {
                const selected = data.split('_')[1];
                currentRatio = selected;

                // Answer callback
                await conversation.external(async (externalCtx) => {
                    try {
                        await externalCtx.api.answerCallbackQuery(callbackId);
                    } catch (e) {
                        console.error('Error answering callback:', e);
                    }
                });

                // Update UI
                const ui = buildUI();
                if (msgMeta?.messageId) {
                    await conversation.external(async (externalCtx) => {
                        try {
                            await externalCtx.api.editMessageText(
                                msgMeta.chatId,
                                msgMeta.messageId,
                                ui.text,
                                { reply_markup: ui.keyboard, parse_mode: 'Markdown' },
                            );
                        } catch (e) {
                            const msg = String(e);
                            if (!msg.includes('message is not modified')) {
                                console.error('Error editing message:', e);
                            }
                        }
                    });
                }
                continue;
            }

            // Handle save
            if (data === 'save_settings') {
                // Save settings to database
                await conversation.external(async (externalCtx) => {
                    await externalCtx.userService.updateSettings(user.id, {
                        aspectRatio: currentRatio,
                    });
                });

                // Answer callback and show confirmation
                await conversation.external(async (externalCtx) => {
                    try {
                        await externalCtx.api.answerCallbackQuery(callbackId, {
                            text: '✅ Настройки сохранены!',
                        });
                    } catch (e) {
                        console.error('Error answering callback:', e);
                    }
                });

                // Delete settings message
                if (msgMeta?.messageId) {
                    await conversation.external(async (externalCtx) => {
                        try {
                            await externalCtx.api.deleteMessage(
                                msgMeta.chatId,
                                msgMeta.messageId,
                            );
                        } catch (e) {
                            console.error('Error deleting message:', e);
                        }
                    });
                }

                // Send confirmation
                await conversation.external(async (externalCtx) => {
                    await externalCtx.reply(
                        `✅ Настройки сохранены!\n\n📐 Соотношение сторон: **${currentRatio}**`,
                        { parse_mode: 'Markdown' },
                    );
                });

                return;
            }

            // Handle close
            if (data === 'close_settings') {
                await conversation.external(async (externalCtx) => {
                    try {
                        await externalCtx.api.answerCallbackQuery(callbackId);
                    } catch (e) {
                        console.error('Error answering callback:', e);
                    }
                });

                if (msgMeta?.messageId) {
                    await conversation.external(async (externalCtx) => {
                        try {
                            await externalCtx.api.deleteMessage(
                                msgMeta.chatId,
                                msgMeta.messageId,
                            );
                        } catch (e) {
                            console.error('Error deleting message:', e);
                        }
                    });
                }

                return;
            }
        }
    } catch (error: any) {
        await conversation.external(async (externalCtx) => {
            console.error('[SETTINGS] Conversation error:', error);
            await externalCtx.reply(
                '❌ Произошла ошибка. Пожалуйста, попробуйте снова.',
            );
        });
    }
}
