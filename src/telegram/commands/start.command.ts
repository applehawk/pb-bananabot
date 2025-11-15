import { Composer } from 'grammy';
import { MyContext } from '../telegram-context.interface';

export const startCommand = new Composer<MyContext>();

startCommand.command('start', async (ctx) => {
  const refCode = ctx.match as string; // Реферальный код из /start ref_CODE

  try {
    // Регистрация пользователя
    const user = await ctx.userService.upsert({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      languageCode: ctx.from.language_code || 'ru',
      referredBy: refCode || undefined,
    });

    // Обработка реферального кода
    if (refCode) {
      try {
        const referrer = await ctx.userService.findByReferralCode(refCode);

        if (referrer && referrer.id !== user.id) {
          // Начислить реферальный бонус
          await ctx.creditsService.grantReferralBonus(referrer.id, user.id);

          await ctx.reply(
            `🎉 Вы присоединились по реферальной ссылке!\n\n` +
              `Вы получили дополнительные кредиты в подарок!`,
          );
        }
      } catch (error) {
        // Тихо игнорируем ошибки реферальной системы
        console.error('Referral error:', error);
      }
    }

    // Приветственное сообщение
    const welcomeMessage =
      `🎨 Добро пожаловать в AI Image Generator!\n\n` +
      `Я помогу вам создавать уникальные изображения с помощью искусственного интеллекта.\n\n` +
      `💎 Ваш баланс: ${user.credits} кредитов\n\n` +
      `📝 Просто отправьте текстовое описание, и я создам изображение.\n` +
      `🖼 Или отправьте фото с подписью для редактирования.\n\n` +
      `Используйте /help для просмотра всех команд.`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💡 Примеры', callback_data: 'examples' },
            { text: '⚙️ Настройки', callback_data: 'settings' },
          ],
          [{ text: '💳 Купить кредиты', callback_data: 'buy_credits' }],
        ],
      },
    });

    // Показать реферальную ссылку
    if (user.referralCode) {
      const botUsername = (await ctx.api.getMe()).username;
      const refLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

      await ctx.reply(
        `🔗 Ваша реферальная ссылка:\n${refLink}\n\n` +
          `Приглашайте друзей и получайте бонусные кредиты!`,
      );
    }
  } catch (error) {
    console.error('Start command error:', error);
    await ctx.reply(
      '❌ Произошла ошибка при регистрации. Попробуйте еще раз позже.',
    );
  }
});
