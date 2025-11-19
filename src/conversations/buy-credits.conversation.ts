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

  // FIX 2: Write logic linearly. grammY handles skipping this reply on replay.
  let message = `💎 <b>Покупка кредитов</b>\n\n`; // Switched to HTML for safety
  message += `Ваш текущий баланс: <b>${user.credits.toFixed(1)}</b> кредитов\n\n`;
  message += `📦 <b>Доступные пакеты:</b>\n\n`;

  const keyboard = new InlineKeyboard();

  for (const pkg of packages) {
    const badge = pkg.popular ? '⭐ ' : '';
    const discount = pkg.discount > 0 ? ` (-${pkg.discount}%)` : '';
    
    // Using HTML tags <b> and <i> prevents crashes with special chars in names
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
    parse_mode: 'HTML', // Safer than Markdown
    reply_markup: keyboard,
  });

  // --- Wait for Package Selection ---
  
  const packageResponse = await conversation.waitFor('callback_query:data');
  const callbackData = packageResponse.callbackQuery.data;
  
  // Important: Answer callback immediately to stop the loading animation
  await packageResponse.answerCallbackQuery();

  if (callbackData === 'cancel_purchase') {
    await ctx.reply('❌ Покупка отменена.');
    return;
  }

  if (!callbackData.startsWith('select_package:')) {
    // If user clicked an old button or something unexpected
    await ctx.reply('❌ Пожалуйста, выберите пакет из меню.');
    return;
  }

  const packageId = callbackData.replace('select_package:', '');

  // Fetch specific package details
  const selectedPackage = await conversation.external(async (ctx) => {
    const paymentService = (ctx as any).paymentService;
    if (paymentService) {
      return await paymentService.getCreditPackage(packageId);
    }
    return null;
  });

  if (!selectedPackage) {
    await ctx.reply('❌ Выбранный пакет не найден (возможно, он был удален).');
    return;
  }

  // --- Payment Method Selection ---

  let paymentMessage = `💎 <b>${selectedPackage.name}</b>\n\n`;
  paymentMessage += `Кредиты: ${selectedPackage.credits}\n\n`;
  paymentMessage += `📱 <b>Выберите способ оплаты:</b>\n\n`;

  const paymentKeyboard = new InlineKeyboard();

  if (selectedPackage.priceYooMoney) {
    paymentKeyboard.text(
      `💳 YooMoney - ${selectedPackage.priceYooMoney} руб.`,
      `pay:yoomoney:${packageId}`,
    );
    paymentKeyboard.row();
  }
  // ... add other methods ...
  
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
    await ctx.reply('❌ Покупка отменена.');
    return;
  }

  if (paymentData === 'back_to_packages') {
    // Restart conversation cleanly
    await ctx.conversation.enter('buy_credits'); 
    return;
  }

  if (!paymentData.startsWith('pay:')) {
    await ctx.reply('❌ Неверный выбор.');
    return;
  }

  const [, paymentMethod, pkgId] = paymentData.split(':');

  // --- Create Payment ---

  await ctx.reply('⏳ Создаю платеж...');

  let transaction: any = null;
  let paymentSystem: PaymentSystemEnum;

  // Determine enum based on string
  switch (paymentMethod) {
    case 'yoomoney': paymentSystem = PaymentSystemEnum.YOOMONEY; break;
    case 'stars': paymentSystem = PaymentSystemEnum.STARS; break;
    case 'crypto': paymentSystem = PaymentSystemEnum.CRYPTO; break;
    default: return;
  }

  try {
    transaction = await conversation.external(async (ctx) => {
      const paymentService = (ctx as any).paymentService;
      return await paymentService.createPayment(String(telegramId), pkgId, paymentSystem);
    });

    if (!transaction) throw new Error('Transaction is null');
    
  } catch (error) {
    await ctx.reply('❌ Ошибка создания платежа. Попробуйте позже.');
    return;
  }

  // --- Handle Specific Methods ---

  if (paymentSystem === PaymentSystemEnum.YOOMONEY) {
    const metadata = transaction.metadata as any;
    const paymentForm = metadata?.form || '';
    const payUrl = extractPaymentUrl(paymentForm);

    await ctx.reply(
      `✅ <b>Платеж создан!</b>\n\n` +
        `💳 Сумма: ${transaction.amount} руб.\n` +
        `🔗 <a href="${payUrl}">Нажмите здесь для оплаты</a>`,
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

    // FIX 3: Loop for checking payment
    let paymentVerified = false;
    
    // Allow user to check 10 times or until verified
    for (let i = 0; i < 10; i++) {
      const confirmResponse = await conversation.waitFor('callback_query:data');
      
      // If user does something else (like cancel), exit loop
      if (confirmResponse.callbackQuery.data === 'cancel_purchase') {
         await ctx.reply('Платеж отменен.');
         return;
      }

      if (confirmResponse.callbackQuery.data.startsWith('check_payment:')) {
        
        // Check status via external service
        const isPaid = await conversation.external(async (ctx) => {
           const paymentService = (ctx as any).paymentService;
           return await paymentService.validatePayment(transaction.paymentId);
        });

        if (isPaid) {
          await confirmResponse.answerCallbackQuery({ text: '✅ Оплата получена!' });
          paymentVerified = true;
          break; // Exit loop
        } else {
          await confirmResponse.answerCallbackQuery({ text: '⏳ Оплата еще не поступила. Попробуйте через минуту.' });
          // Loop continues, waiting for next click
        }
      }
    }

    if (paymentVerified) {
       await ctx.reply(`🎉 <b>Успешно!</b>\nКредиты зачислены.`, { parse_mode: 'HTML' });
    }

  } 
  // Handle Stars/Crypto...
}

function extractPaymentUrl(formHtml: string): string {
  // Improved Regex to handle single or double quotes
  const match = formHtml.match(/action=["']([^"']+)["']/);
  return match && match[1] ? match[1] : 'https://yoomoney.ru';
}