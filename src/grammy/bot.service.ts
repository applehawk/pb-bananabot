import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { UserService } from '../user/user.service';
import { User } from '@prisma/client';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';

/**
 * Bot Service (grammY version)
 *
 * Provides high-level bot operations:
 * - User management (upsert)
 * - Messaging utilities
 * - Payment notifications
 */
@Injectable()
export class BotService {
  private readonly adminChatId: string;
  private readonly adminChatId2: string;
  private readonly isProd: boolean;
  readonly minimumBalance: number;

  private readonly logger = new Logger(BotService.name);

  constructor(
    @Inject(forwardRef(() => GrammYService))
    private readonly grammyService: GrammYService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    this.logger.log('BotService initialized');
    this.minimumBalance = configService.get('MINIMUM_BALANCE');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.adminChatId2 = configService.get('ADMIN_CHAT_ID_2');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  /**
   * Upsert user from context
   */
  async upsertUser(ctx: MyContext, referralCode?: string): Promise<void> {
    const { user, referral } = await this.userService.upsert({
      telegramId: ctx.from?.id,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      languageCode: ctx.from?.language_code || 'ru',
      referredBy: referralCode,
    });

    // Notify referrer if applicable
    if (referral) {
      try {
        await this.grammyService.bot.api.sendMessage(
          Number(referral.referrerTelegramId),
          `🎉 <b>По вашей ссылке зарегистрировался новый пользователь!</b>\n\n` +
          `Вам начислено <b>${referral.bonusAmount}</b> монет бани!`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        this.logger.error(
          `Failed to send referral notification to ${referral.referrerTelegramId}:`,
          error,
        );
      }
    }
  }

  /**
   * Send a message to a specific chat
   */
  async sendMessage(chatId: number, message: string): Promise<void> {
    await this.grammyService.bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
  }

  async sendPhoto(
    chatId: number,
    photo: string | any,
    caption?: string,
    reply_markup?: any,
  ): Promise<void> {
    await this.grammyService.bot.api.sendPhoto(chatId, photo, {
      caption,
      reply_markup,
      parse_mode: 'HTML',
    });
  }

  async sendVideo(
    chatId: number,
    video: string | any,
    caption?: string,
    reply_markup?: any,
  ): Promise<void> {
    await this.grammyService.bot.api.sendVideo(chatId, video, {
      caption,
      reply_markup,
      parse_mode: 'HTML',
    });
  }

  /**
   * Notify user of insufficient balance
   */
  async sendInsufficientChargeMessage(
    chatId: number,
    balance: number,
    change: number,
  ): Promise<void> {
    const balanceCurrency = `${balance.toFixed(2)} монет бани`;
    const changeCurrency = `${change.toFixed(2)} монет бани`;
    await this.sendMessage(
      chatId,
      `Требуется пополнить баланс для списания ${changeCurrency}\n\nТекущий баланс: ${balanceCurrency}\n\n`,
    );
  }

  /**
   * Notify user of successful payment
   */
  async sendPaymentSuccessMessage(
    chatId: number,
    balance: number,
  ): Promise<void> {
    await this.sendMessage(
      chatId,
      `Баланс успешно пополнен до ${balance} 🎉 \n\n`,
    );
  }

  /**
   * Notify admins of successful payment
   */
  async sendPaymentSuccessMessageToAdmin(
    username: string,
    balance: number,
    amount: number,
    paymentSystem: PaymentSystemEnum,
  ): Promise<void> {
    const adminIds = [this.adminChatId, this.adminChatId2].filter(Boolean);

    for (const adminId of adminIds) {
      try {
        await this.grammyService.bot.api.sendMessage(
          adminId,
          `Пользователь ${username} оплатил, его баланс ${balance}. Оплаченная сумма: ${amount}. Платежная система ${paymentSystem} 🎉`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send admin notification to ${adminId}:`,
          error,
        );
      }
    }
  }
}
