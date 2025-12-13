import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { UserService } from '../user/user.service';
import { User } from '@prisma/client';
import { PaymentSystemEnum } from '../payment/enum/payment-system.enum';
import { PrismaService } from '../database/prisma.service';

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
  private readonly isProd: boolean;
  readonly minimumBalance: number;

  private readonly logger = new Logger(BotService.name);

  constructor(
    @Inject(forwardRef(() => GrammYService))
    private readonly grammyService: GrammYService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log('BotService initialized');
    this.minimumBalance = configService.get('MINIMUM_BALANCE');
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
  async sendMessage(chatId: number, message: string, options?: { reply_markup?: any }): Promise<void> {
    await this.grammyService.bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...options,
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

  async sendDocument(
    chatId: number,
    document: string | any,
    caption?: string,
    reply_markup?: any,
  ): Promise<void> {
    await this.grammyService.bot.api.sendDocument(chatId, document, {
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
    change: number,
  ): Promise<void> {
    await this.sendMessage(
      chatId,
      `Баланс успешно пополнен до ${balance} 🎉 \n\n`,
    );
  }

  /**
   * Notify admins of new generation
   */
  async sendAdminGenerationNotification(
    username: string,
    prompt: string,
    photo: string | any,
    generationId: string,
    enhancedPrompt?: string,
  ): Promise<void> {
    try {
      const admins = await this.prisma.adminUser.findMany({
        where: { telegramId: { not: null } }
      });

      // Escape HTML characters to prevent breaking the message
      const safePrompt = prompt
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      let caption = `🎨 <b>Новая генерация!</b>\n\n` +
        `👤 Пользователь: @${username}\n` +
        `🆔 GenID: ${generationId}\n` +
        `📝 Промпт: ${safePrompt.length > 500 ? safePrompt.slice(0, 500) + '...' : safePrompt}`;

      if (enhancedPrompt && enhancedPrompt !== prompt) {
        const safeEnhanced = enhancedPrompt
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        caption += `\n✨ Улучшенный промпт: ${safeEnhanced.length > 500 ? safeEnhanced.slice(0, 500) + '...' : safeEnhanced}`;
      }

      // Check final length
      if (caption.length > 1024) {
        caption = caption.slice(0, 1021) + '...';
      }

      for (const admin of admins) {
        if (!admin.telegramId) continue;
        try {
          await this.grammyService.bot.api.sendPhoto(Number(admin.telegramId), photo, {
            caption,
            parse_mode: 'HTML',
          });
        } catch (error) {
          this.logger.error(
            `Failed to send admin generation notification to ${admin.telegramId}:`,
            error,
          );
        }
      }
    } catch (e) {
      this.logger.error('Failed to fetch admins or send notifications', e);
    }
  }
}
