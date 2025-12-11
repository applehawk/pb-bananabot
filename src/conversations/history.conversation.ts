import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { InlineKeyboard } from 'grammy';

/**
 * HISTORY Conversation
 *
 * Shows user's generation history
 */
export async function historyConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  // Get user and history using external
  let user: any = null;
  let history: any[] = [];

  await conversation.external(async (ctx) => {
    user = await ctx.userService.findByTelegramId(telegramId);
    if (user) {
      history = await ctx.generationService.getHistory(user.id, 10);
    }
  });

  if (!user) {
    const botInfo = await conversation.external((ctx) => ctx.api.getMe());
    await ctx.reply('❌ Пользователь не найден.', {
      reply_markup: new InlineKeyboard().url('🚀 Начать', `https://t.me/${botInfo.username}?start=start`)
    });
    return;
  }

  if (history.length === 0) {
    await ctx.reply(
      '📜 История пуста.\n\nИспользуйте /generate для создания первого изображения!',
    );
    return;
  }

  let message = `📜 **История генераций**\n\n`;
  message += `Последние ${history.length} генераций:\n\n`;

  for (const gen of history) {
    const date = gen.createdAt.toLocaleDateString('ru-RU');
    const prompt =
      gen.prompt.length > 50
        ? gen.prompt.substring(0, 50) + '...'
        : gen.prompt;

    message += `🎨 ${prompt}\n`;
    message += `📅 ${date} | 💎 ${gen.creditsUsed}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
