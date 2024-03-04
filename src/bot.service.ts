import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';
import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigService } from '@nestjs/config';
import { replyOrEdit } from './utils/reply-or-edit';
import { UserService } from './user/user.service';
import { PrismaClient } from '@prisma/client';
import { User } from '@prisma/client';
import { PaymentSystemEnum } from './payment/enum/payment-system.enum';

@Injectable()
export class BotService {
  private readonly adminChatId: string;
  private readonly isProd: boolean;

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    
    Logger.log("constructor BotService")
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
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
    const newUser: User = {
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      firstname: ctx.from.first_name,
      lastname: ctx.from.last_name,
      username: ctx.from.username,
      connLimit: 1, balance: 0.0,
    }
    this.userService.upsert(newUser)
  }

  async sendMessage(chatId: number, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, message);
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
    await this.bot.telegram.sendMessage(
      this.adminChatId,
      `Пользователь ${username} оплатил, его баланс ${balance}. Оплаченная сумма: ${amount}. Платежная система ${paymentSystem}  🎉`,
    );
  }
}
