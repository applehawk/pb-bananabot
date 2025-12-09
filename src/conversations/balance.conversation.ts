import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';

/**
 * BALANCE Conversation
 *
 * Shows user balance, statistics, and transaction history
 */
export async function balanceConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  // Get user data and transactions using external
  let user: any = null;
  let transactions: any[] = [];

  await conversation.external(async (ctx) => {
    user = await ctx.userService.findByTelegramId(telegramId);
    if (user) {
      transactions = await ctx.creditsService.getTransactionHistory(user.id, 5);
    }
    return null;
  });

  if (!user) {
    await ctx.reply(
      '❌ Пользователь не найден. Используйте /start для регистрации.',
    );
    return;
  }

  let message = `💰 **Ваш баланс**\n\n`;
  message += `💎 Баланс: **${user.credits.toFixed(1)}**\n`;
  message += `🎨 Всего сгенерировано: ${user.totalGenerated}\n`;
  message += `📅 Участник с: ${user.createdAt.toLocaleDateString('ru-RU')}\n\n`;

  if (transactions.length > 0) {
    message += `📜 **Последние операции:**\n`;
    for (const tx of transactions.slice(0, 5)) {
      const emoji = tx.creditsAdded > 0 ? '➕' : '➖';
      const type = getTransactionTypeName(tx.type);
      const credits = Math.abs(tx.creditsAdded).toFixed(1);
      message += `${emoji} ${type}: ${credits} монет\n`;
    }
    message += `\n`;
  }


  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💳 Купить кредиты', callback_data: 'buy_credits' },
          { text: '🎁 Бонусы', callback_data: 'daily_bonus' },
        ],
        [
          {
            text: '📜 Полная история',
            callback_data: 'history',
          },
        ],
      ],
    },
  });
}

/**
 * Helper function to get transaction type name in Russian
 */
function getTransactionTypeName(type: string): string {
  const names: Record<string, string> = {
    PURCHASE: 'Покупка',
    BONUS: 'Бонус',
    REFERRAL: 'Реферал',
    DAILY_BONUS: 'Ежедневный бонус',
    ADMIN_ADJUSTMENT: 'Корректировка',
    GENERATION_COST: 'Генерация',
    REFUND: 'Возврат',
  };
  return names[type] || type;
}
