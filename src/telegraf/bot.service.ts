import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';
import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from '../enum/command.enum';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigService } from '@nestjs/config';
import { replyOrEdit } from '../utils/reply-or-edit';
import { UserService } from '../user/user.service';
import { PrismaClient } from '@prisma/client';
import { User } from '@prisma/client';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';
import { create } from 'domain';

@Injectable()
export class BotService {
  private readonly adminChatId: string;
  private readonly adminChatId2: string;
  private readonly isProd: boolean;
  readonly minimumBalance: number

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    
    Logger.log("constructor BotService")
    this.minimumBalance = configService.get('MINIMUM_BALANCE');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.adminChatId2 = configService.get('ADMIN_CHAT_ID_2');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  async start(ctx: Context) {
   await replyOrEdit(
      ctx,
      SCENES[CommandEnum.START].navigateText,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].navigateButtons),
    );
  }

  async upsertUser(ctx: Context) {
    const upsertUser: User = {
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      firstname: ctx.from.first_name,
      lastname: ctx.from.last_name,
      username: ctx.from.username,
      balance: 0.0, connLimit: 1,
      createdAt: new Date(),
    }
    this.userService.upsert(upsertUser)
  }

  async sendMessage(chatId: number, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, message);
  }


  async sendInsufficientChargeMessage(chatId: number, balance: number, change: number): Promise<void> {
    const balanceCurrency = balance.toLocaleString('ru-RU', {style: 'currency',currency: 'RUB',});
    const changeCurrency = change.toLocaleString('ru-RU', {style: 'currency',currency: 'RUB',});
    await this.sendMessage(
      chatId,
      `Требуется пополнить баланс для списания ${changeCurrency}\n\nТекущий баланс: ${balanceCurrency}\n\n`,
    );
  }

  async sendPaymentSuccessMessage(chatId: number, balance: number): Promise<void> {
    await this.sendMessage(
      chatId,
      `Баланс успешно пополнен до ${balance} 🎉 \n\n`,
    );
  }

  async sendPaymentSuccessMessageToAdmin(
    username: string,
    balance: number,
    amount: number,
    paymentSystem: PaymentSystemEnum,
  ): Promise<void> {
     [this.adminChatId, this.adminChatId2].map(async adminId => {
      await this.bot.telegram.sendMessage(
        adminId,
        `Пользователь ${username} оплатил, его баланс ${balance}. Оплаченная сумма: ${amount}. Платежная система ${paymentSystem}  🎉`,
      );
    })
  }
}
