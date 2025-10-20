import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';
import { PaymentService } from '../../payment/payment.service';
import { PaymentSystemEnum } from '../../payment/enum/payment-system.enum';
import { TariffService } from '../../tariff/tariff.service';
import { UserService } from '../../user/user.service';

/**
 * PAYMENT Conversation
 *
 * Displays payment options for selected tariff.
 * Handles payment creation via YooMoney.
 */
export async function paymentConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  // Get services from context
  const paymentService: PaymentService = (ctx as any).paymentService;
  const tariffService: TariffService = (ctx as any).tariffService;
  const userService: UserService = (ctx as any).userService;

  // Get tariff from session
  const { tariffId } = ctx.session;
  if (!tariffId) {
    await ctx.reply('❌ Тариф не выбран. Вернитесь в меню и выберите тариф.');
    return;
  }

  // Get user and tariff data
  const user = await userService.user({ userId });
  const balance = user.balance.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });
  const tariff = await tariffService.getOneById(tariffId);

  const scene = SCENES[CommandEnum.PAYMENT];
  const text = scene.text(balance, tariff.name);

  // Build keyboard
  const keyboard = new InlineKeyboard();
  for (const row of scene.buttons) {
    for (const button of row) {
      if (button.callback_data) {
        keyboard.text(button.text, button.callback_data);
      }
    }
    keyboard.row();
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });

  // Wait for payment method selection
  const response = await conversation.waitForCallbackQuery([
    CommandEnum.PAY_WITH_YOOMONEY,
    CommandEnum.CONFIRM_PAYMENT,
  ]);

  await response.answerCallbackQuery();

  if (response.callbackQuery.data === CommandEnum.PAY_WITH_YOOMONEY) {
    // Create payment
    try {
      const payment = await paymentService.createPayment(
        userId,
        chatId,
        tariffId,
        PaymentSystemEnum.YOOMONEY,
      );

      const paymentKeyboard = new InlineKeyboard().url('👉 перейти к оплате', payment.url);

      const sentMessage = await ctx.reply(
        `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
        { reply_markup: paymentKeyboard },
      );

      // Schedule link expiration (10 minutes)
      setTimeout(async () => {
        try {
          await ctx.api.editMessageText(
            chatId,
            sentMessage.message_id,
            `Ссылка на оплату истекла. Пожалуйста, попробуйте снова, если вы хотите оплатить подписку.`,
            { parse_mode: 'HTML' },
          );
        } catch (error) {
          // Ignore errors (message may be deleted)
        }
      }, 600000);
    } catch (error) {
      console.log(error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.');
    }
  } else if (response.callbackQuery.data === CommandEnum.CONFIRM_PAYMENT) {
    await ctx.reply(
      'Проверка оплаты выполняется автоматически. Если вы оплатили, подождите несколько минут.',
    );
  }
}