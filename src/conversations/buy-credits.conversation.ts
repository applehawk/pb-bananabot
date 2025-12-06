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

  // FIX 1: Return data from external. Destructure the result.
  // We use an object to return multiple values.
  const { user, packages } = await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService; // Type assertion if needed

    // Parallel fetching is faster
    const [userData, packagesData] = await Promise.all([
      ctx.userService.findByTelegramId(telegramId),
      paymentService ? paymentService.getActiveCreditPackages() : Promise.resolve([])
    ]);

    return { user: userData, packages: packagesData };
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
    if (packages.length > 0) {
      targetPackageId = packages[0].id;
      targetPaymentMethod = 'yoomoney';
      ctx.session.quickBuy = undefined; // Reset flag
    }
  }

  // --- Package Selection ---
  if (!targetPackageId) {
    let message = `💎 <b>Покупка кредитов</b>\n\n`;
    message += `Ваш текущий баланс: <b>${user.credits.toFixed(1)}</b> кредитов\n\n`;
    message += `📦 <b>Доступные пакеты:</b>\n\n`;

    const keyboard = new InlineKeyboard();

    for (const pkg of packages) {
      const badge = pkg.popular ? '⭐ ' : '';
      const discount = pkg.discount > 0 ? ` (-${pkg.discount}%)` : '';

      message += `${badge}<b>${pkg.name}</b>\n`;
      message += `  💎 ${pkg.credits} кредитов\n`;
      message += `  💰 ${pkg.priceYooMoney || pkg.price} руб.${discount}\n`;
      if (pkg.description) {
        message += `  📝 <i>${pkg.description}</i>\n`;
      }
      message += `\n`;

      keyboard.text(
        `${badge}${pkg.name} - ${pkg.credits} кр.`,
        `select_package:${pkg.id}`,
      );
      keyboard.row();
    }

    keyboard.text('❌ Отмена', 'cancel_purchase');

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    const packageResponse = await conversation.waitFor('callback_query:data');
    const callbackData = packageResponse.callbackQuery.data;
    await packageResponse.answerCallbackQuery();

    if (callbackData === 'cancel_purchase') {
      await ctx.deleteMessage();
      return;
    }

    if (!callbackData.startsWith('select_package:')) {
      await ctx.reply('❌ Пожалуйста, выберите пакет из меню.');
      return;
    }

    targetPackageId = callbackData.replace('select_package:', '');
  }

  // Fetch specific package details
  const selectedPackage = await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService;
    if (paymentService && targetPackageId) {
      return await paymentService.getCreditPackage(targetPackageId);
    }
    return null;
  });

  if (!selectedPackage) {
    await ctx.reply('❌ Выбранный пакет не найден (возможно, он был удален).');
    return;
  }

  // --- Payment Method Selection ---
  if (!targetPaymentMethod) {
    let paymentMessage = `💎 <b>${selectedPackage.name}</b>\n\n`;
    paymentMessage += `Кредиты: ${selectedPackage.credits}\n\n`;
    paymentMessage += `📱 <b>Выберите способ оплаты:</b>\n\n`;

    const paymentKeyboard = new InlineKeyboard();

    if (selectedPackage.priceYooMoney) {
      paymentKeyboard.text(
        `💳 YooMoney - ${selectedPackage.priceYooMoney} руб.`,
        `pay:yoomoney:${targetPackageId}`,
      );
      paymentKeyboard.row();
    }

    paymentKeyboard.text('🔙 Назад', 'back_to_packages');
    paymentKeyboard.text('❌ Отмена', 'cancel_purchase');

    await ctx.reply(paymentMessage, {
      parse_mode: 'HTML',
      reply_markup: paymentKeyboard,
    });

    const paymentResponse = await conversation.waitFor('callback_query:data');
    const paymentData = paymentResponse.callbackQuery.data;
    await paymentResponse.answerCallbackQuery();

    if (paymentData === 'cancel_purchase') {
      await ctx.deleteMessage();
      return;
    }

    if (paymentData === 'back_to_packages') {
      await buyCreditsConversation(conversation, ctx);
      return;
    }

    if (!paymentData.startsWith('pay:')) {
      await ctx.reply('❌ Неверный выбор.');
      return;
    }

    const [, method] = paymentData.split(':');
    targetPaymentMethod = method;
  }

  if (!targetPackageId || !targetPaymentMethod) return;


  // --- Create Payment ---

  await ctx.reply('⏳ Создаю платеж...');

  let transaction: any = null;
  let paymentSystem: PaymentSystemEnum;

  // Determine enum based on string
  switch (targetPaymentMethod) {
    case 'yoomoney': paymentSystem = PaymentSystemEnum.YOOMONEY; break;
    case 'stars': paymentSystem = PaymentSystemEnum.STARS; break;
    case 'crypto': paymentSystem = PaymentSystemEnum.CRYPTO; break;
    default: return;
  }

  try {
    transaction = await conversation.external(async (ctx) => {
      const paymentService = (ctx as any).paymentService;
      return await paymentService.createPayment(String(telegramId), targetPackageId, paymentSystem);
    });

    if (!transaction) throw new Error('Transaction is null');

  } catch (error) {
    await ctx.reply('❌ Ошибка создания платежа. Попробуйте позже.');
    return;
  }

  // --- Handle Specific Methods ---

  if (paymentSystem === PaymentSystemEnum.YOOMONEY) {
    const metadata = transaction.metadata as any;
    // FIX: Use pre-generated URL from metadata, or fallback to extraction if missing (backward compatibility)
    const payUrl = metadata.url || extractPaymentUrl(metadata?.form || '');

    await ctx.reply(
      `✅ <b>Платеж создан!</b>\n\n` +
      `💳 Сумма: ${transaction.amount} руб.\n` +
      `🔗 <a href="${payUrl}">Нажмите здесь для оплаты</a>\n\n` +
      `<i>После оплаты нажмите кнопку "Я оплатил", чтобы проверить статус.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Оплатить', url: payUrl }],
            [{ text: '✅ Я оплатил (Проверить)', callback_data: `check_payment:${transaction.paymentId}` }]
          ],
        },
      },
    );

    // FIX 2: Non-blocking. Return immediately.
    // The global callback handler in bot.update.ts will handle 'check_payment:' events.
    return;

  }
  // Handle Stars/Crypto...
}

function extractPaymentUrl(formHtml: string): string {
  // Improved Regex to handle single or double quotes and potential HTML entities
  // Matches action="URL" or action='URL'
  const match = formHtml.match(/action=["']([^"']+)["']/);
  if (match && match[1]) {
    // Decode HTML entities if present (basic ones)
    let url = match[1].replace(/&amp;/g, '&');
    return url;
  }
  return 'https://yoomoney.ru';
}