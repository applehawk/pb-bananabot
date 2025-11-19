import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';
import { InlineKeyboard } from 'grammy';
import { CreditPackage } from '@prisma/client';

/**
 * BUY_CREDITS Conversation
 *
 * Allows users to purchase credits using YooMoney, Telegram Stars, or Crypto
 */
export async function buyCreditsConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  console.log('[BUY_CREDITS] Conversation started');

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  console.log('[BUY_CREDITS] Telegram ID:', telegramId);

  // Get user and packages
  let user: any = null;
  let packages: CreditPackage[] = [];

  // IMPORTANT: Use conversation.external() to fetch data
  // This ensures data is available both on first run and replay
  await conversation.external(async (ctx) => {
    user = await ctx.userService.findByTelegramId(telegramId);

    // Get active credit packages from payment service
    const paymentService = (ctx as any).paymentService;
    console.log('[BUY_CREDITS] PaymentService available:', !!paymentService);

    if (paymentService) {
      packages = await paymentService.getActiveCreditPackages();
      console.log('[BUY_CREDITS] Fetched packages from service:', packages.length);
    } else {
      console.log('[BUY_CREDITS] PaymentService not available, this is likely a replay');
      // On replay, PaymentService might not be available
      // We'll skip the error check in this case
    }
  });

  console.log('[BUY_CREDITS] Found packages:', packages.length);

  if (!user) {
    await ctx.reply(
      '❌ Пользователь не найден. Используйте /start для регистрации.',
    );
    return;
  }

  // Only show packages and wait for selection if we have packages
  // Skip this on replay (when packages might be empty due to missing PaymentService)
  if (packages.length === 0) {
    console.log('[BUY_CREDITS] No packages available, skipping to waitFor');
    // Don't return here - just skip to waitFor
    // This allows replays to work correctly
  } else {
    // Step 1: Show available packages (only on first run)
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

      // Add button for this package
      keyboard.text(
        `${badge}${pkg.name} - ${pkg.credits} кредитов`,
        `select_package:${pkg.id}`,
      );
      keyboard.row();
    }

    keyboard.text('❌ Отмена', 'cancel_purchase');

    console.log('[BUY_CREDITS] Sending package list...');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    console.log('[BUY_CREDITS] Package list sent');
  }

  console.log('[BUY_CREDITS] Waiting for user selection...');

  // Step 2: Wait for package selection
  const packageResponse = await conversation.waitFor('callback_query:data');

  console.log('[BUY_CREDITS] Received callback query');
  const callbackData = packageResponse.callbackQuery?.data;

  console.log('[BUY_CREDITS] Package selection callback:', callbackData);

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

  const packageId = callbackData.replace('select_package:', '');
  console.log('[BUY_CREDITS] Package ID:', packageId);

  let selectedPackage: CreditPackage | null = null;

  await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService;
    if (paymentService) {
      selectedPackage = await paymentService.getCreditPackage(packageId);
      console.log('[BUY_CREDITS] Selected package:', selectedPackage?.name);
    }
  });

  if (!selectedPackage) {
    await ctx.reply('❌ Выбранный пакет не найден.');
    return;
  }

  // Step 3: Choose payment method
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

  // Step 4: Wait for payment method selection
  const paymentResponse = await conversation.waitFor('callback_query:data');
  const paymentData = paymentResponse.callbackQuery?.data;

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
    // Restart conversation
    await ctx.conversation.enter('buy_credits');
    return;
  }

  if (!paymentData.startsWith('pay:')) {
    await ctx.reply('❌ Неверный выбор способа оплаты.');
    return;
  }

  const [, paymentMethod, pkgId] = paymentData.split(':');

  // Step 5: Create payment
  let transaction: any = null;
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

  try {
    await conversation.external(async (ctx) => {
      const paymentService = (ctx as any).paymentService;
      if (paymentService) {
        transaction = await paymentService.createPayment(
          String(telegramId),
          pkgId,
          paymentSystem,
        );
      }
    });

    if (!transaction) {
      throw new Error('Не удалось создать платеж');
    }

    // Step 6: Show payment instructions based on method
    if (paymentSystem === PaymentSystemEnum.YOOMONEY) {
      const metadata = transaction.metadata as any;
      const paymentForm = metadata?.form || '';

      if (paymentForm) {
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
                [
                  {
                    text: '💳 Оплатить',
                    url: extractPaymentUrl(paymentForm),
                  },
                ],
                [
                  {
                    text: '✅ Я оплатил',
                    callback_data: `check_payment:${transaction.paymentId}`,
                  },
                ],
              ],
            },
          },
        );
      } else {
        throw new Error('Форма оплаты не сгенерирована');
      }
    } else if (paymentSystem === PaymentSystemEnum.STARS) {
      await ctx.reply(
        `✅ **Платеж создан!**\n\n` +
          `⭐ Сумма: ${transaction.amount} звезд\n` +
          `📦 Пакет: ${selectedPackage.name}\n` +
          `💎 Кредиты: ${selectedPackage.credits}\n\n` +
          `🔜 Функция оплаты через Telegram Stars будет доступна в ближайшее время.`,
        {
          parse_mode: 'Markdown',
        },
      );
    } else if (paymentSystem === PaymentSystemEnum.CRYPTO) {
      await ctx.reply(
        `✅ **Платеж создан!**\n\n` +
          `₿ Сумма: ${transaction.amount} USDT\n` +
          `📦 Пакет: ${selectedPackage.name}\n` +
          `💎 Кредиты: ${selectedPackage.credits}\n\n` +
          `🔜 Функция криптоплатежей будет доступна в ближайшее время.`,
        {
          parse_mode: 'Markdown',
        },
      );
    }

    // Optional: Wait for payment confirmation if YooMoney
    if (paymentSystem === PaymentSystemEnum.YOOMONEY) {
      const confirmResponse = await conversation.waitFor('callback_query:data');
      const confirmData = confirmResponse.callbackQuery?.data;

      if (confirmData?.startsWith('check_payment:')) {
        await confirmResponse.answerCallbackQuery({
          text: 'Проверяю платеж...',
        });

        let isPaid = false;
        await conversation.external(async (ctx) => {
          const paymentService = (ctx as any).paymentService;
          if (paymentService) {
            isPaid = await paymentService.validatePayment(
              transaction.paymentId,
            );
          }
        });

        if (isPaid) {
          await ctx.reply(
            `✅ **Оплата подтверждена!**\n\n` +
              `💎 На ваш счет зачислено ${selectedPackage.credits} кредитов.\n` +
              `Спасибо за покупку!`,
            {
              parse_mode: 'Markdown',
            },
          );
        } else {
          await ctx.reply(
            `⏳ **Платеж еще не подтвержден**\n\n` +
              `Как только оплата пройдет, кредиты будут зачислены автоматически.\n` +
              `Проверьте баланс через несколько минут командой /balance`,
            {
              parse_mode: 'Markdown',
            },
          );
        }
      }
    }
  } catch (error) {
    await ctx.reply(
      `❌ Ошибка при создании платежа: ${error.message}\n\n` +
        `Пожалуйста, попробуйте позже или обратитесь в поддержку.`,
    );
  }
}

/**
 * Extract payment URL from YooMoney payment form HTML
 */
function extractPaymentUrl(formHtml: string): string {
  // Extract action URL from form
  const match = formHtml.match(/action="([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  // Fallback to YooMoney homepage
  return 'https://yoomoney.ru';
}
