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
  async upsertUser(ctx: MyContext): Promise<void> {
    const upsertUser: User = {
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      firstname: ctx.from?.first_name || null,
      lastname: ctx.from?.last_name || null,
      username: ctx.from?.username || null,
      balance: 0.0,
      createdAt: new Date(),
    };
    await this.userService.upsert(upsertUser);
  }

  /**
   * Send a message to a specific chat
   */
  async sendMessage(chatId: number, message: string): Promise<void> {
    await this.grammyService.bot.api.sendMessage(chatId, message);
  }

  /**
   * Notify user of insufficient balance
   */
  async sendInsufficientChargeMessage(
    chatId: number,
    balance: number,
    change: number,
  ): Promise<void> {
    const balanceCurrency = balance.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });
    const changeCurrency = change.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });
    await this.sendMessage(
      chatId,
      `Требуется пополнить баланс для списания ${changeCurrency}\n\nТекущий баланс: ${balanceCurrency}\n\n`,
    );
  }

  /**
   * Notify user of successful payment
   */
  async sendPaymentSuccessMessage(chatId: number, balance: number): Promise<void> {
    await this.sendMessage(chatId, `Баланс успешно пополнен до ${balance} 🎉 \n\n`);
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
        this.logger.error(`Failed to send admin notification to ${adminId}:`, error);
      }
    }
  }
}