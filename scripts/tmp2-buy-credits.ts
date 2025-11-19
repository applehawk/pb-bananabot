import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';
import { InlineKeyboard } from 'grammy';
import { CreditPackage } from '@prisma/client';

/**
 * BUY_CREDITS Conversation - Clean version
 * Handles: Package selection → Payment method → Payment creation
 */
export async function buyCreditsConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const runId = Math.random().toString(36).substring(7);
  console.log(`[BUY_CREDITS:${runId}] START`);

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  // Fetch user and packages
  let user: any = null;
  let packages: CreditPackage[] = [];

  await conversation.external(async (ctx) => {
    user = await ctx.userService.findByTelegramId(telegramId);
    const paymentService = (ctx as any).paymentService;

    if (paymentService) {
      packages = await paymentService.getActiveCreditPackages();
      console.log(`[BUY_CREDITS:${runId}] Loaded ${packages.length} packages`);
    } else {
      console.log(`[BUY_CREDITS:${runId}] PaymentService unavailable (replay)`);
    }
  });

  if (!user) {
    await ctx.reply('❌ Пользователь не найден. Используйте /start для регистрации.');
    return;
  }

  // Show packages list (only on first run when packages are loaded)
  if (packages.length > 0) {
    let message = `💎 **Покупка кредитов**\n\n`;
    message += `Ваш текущий баланс: **${user.credits.toFixed(1)}** кредитов\n\n`;
    message += `📦 **Доступные пакеты:**\n\n`;

    const keyboard = new InlineKeyboard();

    for (const pkg of packages) {
      const badge = pkg.popular ? '⭐ ' : '';
      const discount = pkg.discount > 0 ? ` (-${pkg.discount}%)` : '';

      message += `${badge}**${pkg.name}**\n`;
      message += `  💎 ${pkg.credits} кредитов\n`;
      message += `  💰 ${pkg.priceYooMoney || pkg.price} руб.${discount}\n`;
      if (pkg.description) {
        message += `  📝 ${pkg.description}\n`;
      }
      message += `\n`;

      keyboard.text(
        `${badge}${pkg.name} - ${pkg.credits} кредитов`,
        `select_package:${pkg.id}`,
      );
      keyboard.row();
    }

    keyboard.text('❌ Отмена', 'cancel_purchase');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  console.log(`[BUY_CREDITS:${runId}] Waiting for package selection`);

  // STEP 1: Wait for package selection
  const packageResponse = await conversation.waitFor('callback_query:data');
  const callbackData = packageResponse.callbackQuery?.data;

  console.log(`[BUY_CREDITS:${runId}] Received callback: ${callbackData}`);

  if (!callbackData) {
    await ctx.reply('❌ Ошибка выбора пакета.');
    return;
  }

  await packageResponse.answerCallbackQuery();

  if (callbackData === 'cancel_purchase') {
    await ctx.reply('❌ Покупка отменена.');
    return;
  }

  if (!callbackData.startsWith('select_package:')) {
    await ctx.reply('❌ Неверный выбор.');
    return;
  }

  // Get selected package
  const packageId = callbackData.replace('select_package:', '');
  let selectedPackage: CreditPackage | null = null;

  await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService;
    if (paymentService) {
      selectedPackage = await paymentService.getCreditPackage(packageId);
      console.log(`[BUY_CREDITS:${runId}] Selected: ${selectedPackage?.name}`);
    }
  });

  if (!selectedPackage) {
    await ctx.reply('❌ Выбранный пакет не найден.');
    return;
  }

  // Show payment methods
  let paymentMessage = `💎 **${selectedPackage.name}**\n\n`;
  paymentMessage += `Кредиты: ${selectedPackage.credits}\n\n`;
  paymentMessage += `📱 **Выберите способ оплаты:**\n\n`;

  const paymentKeyboard = new InlineKeyboard();

  if (selectedPackage.priceYooMoney) {
    paymentMessage += `💳 YooMoney: **${selectedPackage.priceYooMoney} руб.**\n`;
    paymentKeyboard.text(
      `💳 YooMoney - ${selectedPackage.priceYooMoney} руб.`,
      `pay:yoomoney:${packageId}`,
    );
    paymentKeyboard.row();
  }

  if (selectedPackage.priceStars) {
    paymentMessage += `⭐ Telegram Stars: **${selectedPackage.priceStars} звезд**\n`;
    paymentKeyboard.text(
      `⭐ Stars - ${selectedPackage.priceStars} звезд`,
      `pay:stars:${packageId}`,
    );
    paymentKeyboard.row();
  }

  if (selectedPackage.priceCrypto) {
    paymentMessage += `₿ Криптовалюта: **${selectedPackage.priceCrypto} USDT**\n`;
    paymentKeyboard.text(
      `₿ Crypto - ${selectedPackage.priceCrypto} USDT`,
      `pay:crypto:${packageId}`,
    );
    paymentKeyboard.row();
  }

  paymentKeyboard.text('🔙 Назад', 'back_to_packages');
  paymentKeyboard.text('❌ Отмена', 'cancel_purchase');

  await ctx.reply(paymentMessage, {
    parse_mode: 'Markdown',
    reply_markup: paymentKeyboard,
  });

  console.log(`[BUY_CREDITS:${runId}] Waiting for payment method`);

  // STEP 2: Wait for payment method selection
  const paymentResponse = await conversation.waitFor('callback_query:data');
  const paymentData = paymentResponse.callbackQuery?.data;

  console.log(`[BUY_CREDITS:${runId}] Payment method: ${paymentData}`);

  if (!paymentData) {
    await ctx.reply('❌ Ошибка выбора способа оплаты.');
    return;
  }

  await paymentResponse.answerCallbackQuery();

  if (paymentData === 'cancel_purchase') {
    await ctx.reply('❌ Покупка отменена.');
    return;
  }

  if (paymentData === 'back_to_packages') {
    await ctx.conversation.enter('buy_credits');
    return;
  }

  if (!paymentData.startsWith('pay:')) {
    await ctx.reply('❌ Неверный выбор способа оплаты.');
    return;
  }

  // Parse payment data
  const [, paymentMethod, pkgId] = paymentData.split(':');
  let paymentSystem: PaymentSystemEnum;

  switch (paymentMethod) {
    case 'yoomoney':
      paymentSystem = PaymentSystemEnum.YOOMONEY;
      break;
    case 'stars':
      paymentSystem = PaymentSystemEnum.STARS;
      break;
    case 'crypto':
      paymentSystem = PaymentSystemEnum.CRYPTO;
      break;
    default:
      await ctx.reply('❌ Неподдерживаемый способ оплаты.');
      return;
  }

  await ctx.reply('⏳ Создаю платеж...');

  // STEP 3: Create payment
  try {
    let transaction: any = null;

    await conversation.external(async (ctx) => {
      const paymentService = (ctx as any).paymentService;
      if (paymentService) {
        transaction = await paymentService.createPayment(
          String(telegramId),
          pkgId,
          paymentSystem,
        );
        console.log(`[BUY_CREDITS:${runId}] Created transaction: ${transaction.id}`);
      }
    });

    if (!transaction) {
      throw new Error('Не удалось создать платеж');
    }

    // Handle YooMoney payment
    if (paymentSystem === PaymentSystemEnum.YOOMONEY) {
      const metadata = transaction.metadata as any;
      const paymentForm = metadata?.form || '';

      if (paymentForm) {
        const paymentUrl = extractPaymentUrl(paymentForm);

        await ctx.reply(
          `✅ **Платеж создан!**\n\n` +
            `💳 Сумма: ${transaction.amount} руб.\n` +
            `📦 Пакет: ${selectedPackage.name}\n` +
            `💎 Кредиты: ${selectedPackage.credits}\n\n` +
            `🔗 Для оплаты перейдите по ссылке ниже.\n` +
            `После оплаты кредиты будут зачислены автоматически.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Оплатить', url: paymentUrl }],
                [{ text: '✅ Я оплатил', callback_data: `check_payment:${transaction.paymentId}` }],
              ],
            },
          },
        );

        console.log(`[BUY_CREDITS:${runId}] Sent payment link`);

        // Wait for payment confirmation
        const confirmResponse = await conversation.waitFor('callback_query:data');
        const confirmData = confirmResponse.callbackQuery?.data;

        if (confirmData?.startsWith('check_payment:')) {
          await confirmResponse.answerCallbackQuery({ text: 'Проверяю платеж...' });

          let isPaid = false;
          await conversation.external(async (ctx) => {
            const paymentService = (ctx as any).paymentService;
            if (paymentService) {
              isPaid = await paymentService.validatePayment(transaction.paymentId);
            }
          });

          if (isPaid) {
            await ctx.reply(
              `✅ **Оплата подтверждена!**\n\n` +
                `💎 На ваш счет зачислено ${selectedPackage.credits} кредитов.\n` +
                `Спасибо за покупку!`,
              { parse_mode: 'Markdown' },
            );
          } else {
            await ctx.reply(
              `⏳ **Платеж еще не подтвержден**\n\n` +
                `Как только оплата пройдет, кредиты будут зачислены автоматически.\n` +
                `Проверьте баланс через несколько минут командой /balance`,
              { parse_mode: 'Markdown' },
            );
          }
        }
      } else {
        throw new Error('Форма оплаты не сгенерирована');
      }
    } else {
      // Other payment methods (not implemented yet)
      await ctx.reply(
        `✅ **Платеж создан!**\n\n` +
          `📦 Пакет: ${selectedPackage.name}\n` +
          `💎 Кредиты: ${selectedPackage.credits}\n\n` +
          `🔜 Этот способ оплаты будет доступен в ближайшее время.`,
        { parse_mode: 'Markdown' },
      );
    }
  } catch (error) {
    console.error(`[BUY_CREDITS:${runId}] Error:`, error);
    await ctx.reply(
      `❌ Ошибка при создании платежа: ${error.message}\n\n` +
        `Пожалуйста, попробуйте позже или обратитесь в поддержку.`,
    );
  }
}

/**
 * Extract payment URL from YooMoney form HTML
 */
function extractPaymentUrl(formHtml: string): string {
  const match = formHtml.match(/action="([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  return 'https://yoomoney.ru';
}
