import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { GrammYService } from './grammy.service';
import { ConfigService } from '@nestjs/config';

/**
 * Webhook Controller
 *
 * Handles incoming Telegram webhook requests in production.
 * Validates secret token and forwards updates to the bot.
 */
@Controller('telegram')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly grammY: GrammYService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Webhook endpoint for Telegram updates
   *
   * Security: Validates X-Telegram-Bot-Api-Secret-Token header
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: boolean }> {
    const expectedToken = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );

    // Validate secret token if configured
    if (expectedToken && secretToken !== expectedToken) {
      this.logger.warn('Invalid secret token received');
      return { ok: false };
    }

    try {
      const update = req.body;
      await this.grammY.bot.handleUpdate(update);
      return { ok: true };
    } catch (error) {
      this.logger.error('Error handling webhook update:', error);
      return { ok: false };
    }
  }
}
