import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';
import { InlineKeyboard } from 'grammy';
import { CreditPackage } from '@prisma/client';

export async function buyCreditsConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  // 2. Initial Data Fetch (User + Packages)
  const { user, packages, paymentUrls } = await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService;

    const [userData, packagesData] = await Promise.all([
      ctx.userService.findByTelegramId(telegramId),
      paymentService ? paymentService.getActiveCreditPackages() : Promise.resolve([])
    ]);

    // Generate URLs for all packages
    const urls: Record<string, string> = {};
    if (paymentService && packagesData) {
      for (const pkg of packagesData) {
        urls[pkg.id] = paymentService.generateInitPayUrl(
          telegramId, // userId
          ctx.chat?.id || telegramId, // chatId
          pkg.id
        );
      }
    }

    return { user: userData, packages: packagesData, paymentUrls: urls };
  });

  if (!user) {
    await ctx.reply('❌ Пользователь не найден. Используйте /start.');
    return;
  }

  if (!packages || packages.length === 0) {
    await ctx.reply('❌ В данный момент нет доступных пакетов.');
    return;
  }

  // --- Quick Buy Logic ---
  let targetPackageId: string | undefined;
  let targetPaymentMethod: string | undefined;

  // Safely access session
  if (ctx.session && ctx.session.quickBuy) {
    // ... logic ...
  }

  // --- Package Selection ---
  if (!targetPackageId) {
    let message = `💎 <b>Покупка кредитов</b>\n\n`;
    message += `Ваш текущий баланс: <b>${user.credits.toFixed(1)}</b> руб.\n\n`;
    message += `📦 <b>Доступные пакеты пополнения баланса:</b>\n\n`;

    const keyboard = new InlineKeyboard();

    for (const pkg of packages) {
      const badge = pkg.popular ? '⭐ ' : '';
      const discount = pkg.discount > 0 ? ` (-${pkg.discount}%)` : '';

      message += `${badge}<b>${pkg.name}</b>\n`;
      message += `  💎 ${pkg.priceYooMoney || pkg.price} руб.${discount}\n`;
      if (pkg.description) {
        message += `  📝 <i>${pkg.description}</i>\n`;
      }
      message += `\n`;

      const payUrl = paymentUrls[pkg.id];

      keyboard.url(
        `${badge}${pkg.name} - ${pkg.credits} руб.`,
        payUrl
      );
      keyboard.row();
    }

    keyboard.text('❌ Отмена', 'cancel_purchase');

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    // URL buttons don't return callbacks to the bot.
    // The user is redirected to the payment page immediately.
    // We can stop the conversation here.
    return;
  }
}