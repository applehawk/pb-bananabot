import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { MyContext } from './telegram-context.interface';
import { BOT_INSTANCE } from './bot.provider';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';

/**
 * Telegram Bot Service
 *
 * Manages Grammy Bot lifecycle and provides high-level bot operations
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly adminIds: number[];

  constructor(
    @Inject(BOT_INSTANCE)
    public readonly bot: Bot<MyContext>,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly generationService: GenerationService,
  ) {
    this.adminIds = this.config.get<number[]>('telegram.adminIds', []);
    this.logger.log('TelegramService initialized');
  }

  async onModuleInit() {
    // Inject services into context
    this.bot.use(async (ctx, next) => {
      ctx.userService = this.userService;
      ctx.creditsService = this.creditsService;
      ctx.generationService = this.generationService;
      await next();
    });

    this.logger.log('Starting bot...');

    // Start bot
    await this.start();
  }

  async onModuleDestroy() {
    this.logger.log('Stopping bot...');
    await this.bot.stop();
  }

  /**
   * Start the bot
   */
  async start() {
    const webhookUrl = this.config.get<string>('telegram.webhookUrl');

    if (webhookUrl) {
      // Webhook mode
      this.logger.log('Starting in webhook mode');
      await this.bot.api.setWebhook(webhookUrl);
    } else {
      // Polling mode (for development)
      this.logger.log('Starting in polling mode');
      this.bot.start({
        onStart: (botInfo) => {
          this.logger.log(`Bot @${botInfo.username} started successfully`);
        },
      });
    }
  }

  /**
   * Send message to a specific chat
   */
  async sendMessage(chatId: number, text: string, options?: any) {
    try {
      return await this.bot.api.sendMessage(chatId, text, options);
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Send photo to a specific chat
   */
  async sendPhoto(chatId: number, photo: string, options?: any) {
    try {
      return await this.bot.api.sendPhoto(chatId, photo, options);
    } catch (error) {
      this.logger.error(`Failed to send photo to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Notify user of insufficient credits
   */
  async sendInsufficientCreditsMessage(
    chatId: number,
    required: number,
    available: number,
  ) {
    const message =
      `💎 Недостаточно кредитов\n\n` +
      `Требуется: ${required}\n` +
      `Доступно: ${available}\n` +
      `Не хватает: ${required - available}\n\n` +
      `Пополните баланс: /buy`;

    await this.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Купить кредиты', callback_data: 'buy_credits' }],
        ],
      },
    });
  }

  /**
   * Notify user of successful generation
   */
  async sendGenerationSuccess(
    chatId: number,
    generation: any,
    imageData?: string,
  ) {
    const cost = generation.creditsUsed;
    const user = await this.userService.findById(generation.userId);

    const caption =
      `🎨 ${generation.prompt}\n\n` +
      `💎 Использовано: ${cost} кредитов\n` +
      `💰 Осталось: ${user.credits} кредитов\n` +
      `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

    const imageSource =
      generation.imageUrl || `data:image/jpeg;base64,${imageData}`;

    await this.sendPhoto(chatId, imageSource, {
      caption,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔄 Вариация',
              callback_data: `regenerate_${generation.id}`,
            },
            { text: '⚙️ Параметры', callback_data: 'settings' },
          ],
          [{ text: '💾 История', callback_data: 'history' }],
        ],
      },
    });
  }

  /**
   * Notify user of generation error
   */
  async sendGenerationError(chatId: number, error: string) {
    await this.sendMessage(
      chatId,
      `❌ Ошибка генерации\n\n${error}\n\nПопробуйте еще раз или обратитесь в поддержку.`,
    );
  }

  /**
   * Notify admins
   */
  async notifyAdmins(message: string) {
    for (const adminId of this.adminIds) {
      try {
        await this.sendMessage(adminId, `🔔 Admin notification:\n\n${message}`);
      } catch (error) {
        this.logger.error(
          `Failed to notify admin ${adminId}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin(userId: number): boolean {
    return this.adminIds.includes(userId);
  }

  /**
   * Get bot info
   */
  async getBotInfo() {
    return this.bot.api.getMe();
  }

  /**
   * Set webhook
   */
  async setWebhook(url: string) {
    const webhookSecret = this.config.get<string>('telegram.webhookSecret');

    return this.bot.api.setWebhook(url, {
      secret_token: webhookSecret,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook() {
    return this.bot.api.deleteWebhook();
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo() {
    return this.bot.api.getWebhookInfo();
  }
}
