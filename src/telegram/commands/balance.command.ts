import { Composer } from 'grammy';
import { MyContext } from '../telegram-context.interface';

export const balanceCommand = new Composer<MyContext>();

balanceCommand.command('balance', async (ctx) => {
  try {
    const user = await ctx.userService.findByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.reply(
        '❌ Пользователь не найден. Используйте /start для регистрации.',
      );
    }

    // Get user statistics
    const stats = await ctx.userService.getStatistics(user.id);

    // Get transaction history
    const transactions = await ctx.creditsService.getTransactionHistory(
      user.id,
      5,
    );

    // Format balance message
    let message = `💰 **Ваш баланс**\n\n`;
    message += `💎 Кредиты: **${user.credits.toFixed(1)}**\n`;
    message += `🎨 Всего сгенерировано: ${user.totalGenerated}\n`;
    message += `📅 Участник с: ${user.createdAt.toLocaleDateString('ru-RU')}\n\n`;

    // Recent transactions
    if (transactions.length > 0) {
      message += `📜 **Последние операции:**\n`;

      for (const tx of transactions.slice(0, 5)) {
        const emoji = tx.creditsAdded > 0 ? '➕' : '➖';
        const type = getTransactionTypeName(tx.type);
        const credits = Math.abs(tx.creditsAdded).toFixed(1);

        message += `${emoji} ${type}: ${credits} кредитов\n`;
      }

      message += `\n`;
    }

    // Credit costs
    message += `💵 **Стоимость генерации:**\n`;
    message += `• Text-to-Image: 1 кредит\n`;
    message += `• Image-to-Image: 1.5 кредита\n`;
    message += `• Multi-Image (2-4): 2 кредита\n`;
    message += `• Multi-Image (5-16): 3 кредита\n`;

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
              callback_data: 'transactions_history',
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error('Balance command error:', error);
    await ctx.reply(
      '❌ Произошла ошибка при получении баланса. Попробуйте позже.',
    );
  }
});

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
