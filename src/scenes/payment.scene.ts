import { Action, Hears, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { PaymentService } from '../payment/payment.service';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { Context } from 'src/interfaces/context.interface';
import { Markup } from 'telegraf';
import { replyOrEdit } from 'src/utils/reply-or-edit';
import { SCENES } from 'src/constants/scenes.const';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';


@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
    constructor(
      private readonly paymentService: PaymentService,
      private readonly tariffService: TariffService,
      private readonly userService: UserService
      ) {
        super();
      }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
      this.logger.log(ctx.scene.session.current);
      const scene = SCENES[ctx.scene.session.current];

      const user = await this.userService.user({ userId: ctx.from.id })
      const balance = user.balance.toString()
      const tariff = await this.tariffService.getOneById(ctx.session.tariffId)
      const text = scene.text(balance, tariff.name)
     // await replyOrEdit(ctx, text, Markup.inlineKeyboard(scene.buttons))
      await ctx.replyWithHTML(scene.text(balance, tariff.name), Markup.inlineKeyboard(scene.buttons));
    }

    @Action(CommandEnum.PAY_WITH_YOOMONEY)
    async payWithYoomoney(@Ctx() ctx: Context) {
      this.logger.log(ctx.scene.session.current);
      console.log('Pay with Yoomoney')
      
      await this.createPaymentAndReply(ctx, PaymentSystemEnum.YOOMONEY);
    }
  
    private async createPaymentAndReply(ctx: Context, paymentSystem: PaymentSystemEnum, email?: string) {
        this.logger.debug(`create payment with ${paymentSystem}`);
        try {
          const { tariffId } = ctx.session;
    
          this.logger.debug(`tariffId ${tariffId}, email ${email}`);
    
          const payment = await this.paymentService.createPayment(
            ctx.from.id,
            ctx.chat.id,
            tariffId,
            paymentSystem,
          );
          this.logger.debug(`payment ${JSON.stringify(payment)}`);
          const sentMessage = await ctx.sendMessage(
            `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
            Markup.inlineKeyboard([
              [Markup.button.url(paymentSystem === 'WALLET' ? '👛 Pay via Wallet' : '👉 перейти к оплате', payment.url)],
            ]),
          );
          this.logger.debug(`sentMessage ${JSON.stringify(sentMessage)}`);
    
          // Удаление кнопки через 10 минут
          setTimeout(async () => {
            const chatId = ctx.chat.id;
            const messageId = sentMessage.message_id;
    
            await ctx.telegram.editMessageText(
              chatId,
              messageId,
              undefined,
              `Ссылка на оплату истекла. Пожалуйста, попробуйте снова, если вы хотите оплатить подписку.`,
              { parse_mode: 'HTML' },
            );
          }, 600000);
        } catch (error) {
          console.log(error);
          await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.');
        }
      }
}
