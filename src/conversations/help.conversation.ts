import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { getMainKeyboard } from '../grammy/keyboards/main.keyboard';

/**
 * HELP Conversation
 *
 * Displays help information, commands, and usage examples
 */
export async function helpConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const helpMessage =
    `🤖 *Что я умею:*\n` +
    `🔹 _Текст_ → Уникальное изображение\n` +
    `🔹 _Фото + Текст_ → Генерация с учетом референса\n` +
    `🔹 _Несколько фото + Текст_ → Стиль и композиция из референсов\n\n` +
    `🤖 **Поддержка и Справка**\n\n` +
    `Вы перешли в режим чата с поддержкой.\n` +
    `Все ваши сообщения будут переданы администратору.\n` +
    `Мы ответим вам в ближайшее время (обычно в течение 24 часов).\n\n` +
    `Для выхода из режима чата нажмите кнопку "❌ Выйти из чата".\n\n`;

  const { chatId, messageId } = await conversation.external(async (ext) => {
    const m = await ext.reply(helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Выйти из чата', callback_data: 'close_help' }]
        ],
      },
    });
    return { chatId: m.chat.id, messageId: m.message_id };
  });

  // Chat Loop
  while (true) {
    const nextCtx = await conversation.wait();

    // Check for callback query (Exit button)
    if (nextCtx.callbackQuery?.data === 'close_help') {
      await conversation.external(async (ext) => {
        await ext.api.answerCallbackQuery(nextCtx.callbackQuery!.id);
        await ext.api.deleteMessage(chatId, messageId);
        await ext.reply('✅ Вы вышли из режима чата.', {
          reply_markup: getMainKeyboard(),
        });
      });
      return;
    }

    // Check for commands
    if (nextCtx.message?.text?.startsWith('/')) {
      const text = nextCtx.message.text;
      if (text === '/cancel' || text === '/exit' || text === '/stop') {
        await conversation.external(async (ext) => {
          await ext.reply('✅ Вы вышли из режима чата.', {
            reply_markup: getMainKeyboard(),
          });
        });
        return;
      }
    }

    // Handle Text Messages
    if (nextCtx.message?.text) {
      const text = nextCtx.message.text;
      const userId = nextCtx.from?.id;

      if (userId) {
        await conversation.external(async (ext) => {
          try {
            // Save message to DB
            const user = await ext.userService.findByTelegramId(userId);
            if (user) {
              await ext.userService.saveChatMessage({
                userId: user.id,
                content: text,
                mode: 'help',
                isFromUser: true
              });

              console.log(`[HelpChat] Saved message from ${userId}: ${text.substring(0, 50)}`);

              // React to message confirmation
              try {
                await ext.api.setMessageReaction(nextCtx.chat!.id, nextCtx.message!.message_id, [{ type: 'emoji', emoji: '👍' }]);
              } catch (e) {
                console.error('[HelpChat] Failed to react to message:', e);
              }
            } else {
              console.error(`[HelpChat] User not found for telegramId: ${userId}`);
            }
          } catch (error) {
            console.error('[HelpChat] Error saving message:', error);
          }
        });
      }
    } else {
      // Not a text message (photo, etc) - handling can be added here if needed
    }
  }
}
