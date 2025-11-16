import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { CommandEnum } from '../enum/command.enum';
import { KeyboardCommands } from './keyboards/main.keyboard';

/**
 * Image Generation Service
 *
 * Регистрирует команды и handlers для генерации изображений
 * Вся бизнес-логика вынесена в conversations
 */
@Injectable()
export class ImageGenService implements OnModuleInit {
  private readonly logger = new Logger(ImageGenService.name);

  constructor(private readonly grammyService: GrammYService) {
    this.logger.log('ImageGenService constructor called');
  }

  /**
   * Register image generation commands and handlers
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('ImageGenService.onModuleInit() - registering commands...');
    this.registerCommands();
    this.registerKeyboardHandlers();
    this.registerPhotoHandler();
    this.logger.log('Image generation commands registered');
  }

  /**
   * Register image generation commands
   */
  private registerCommands(): void {
    const bot = this.grammyService.bot;

    // /generate command - delegates to conversation
    bot.command('generate', async (ctx) => {
      this.logger.log(`[COMMAND HANDLER] ctx.match: "${ctx.match}"`);
      // ctx.match is automatically available in conversation context
      await ctx.conversation.enter(CommandEnum.GENERATE);
    });

    // /balance command - delegates to conversation
    bot.command('balance', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.BALANCE);
    });

    // /help command - delegates to conversation
    bot.command('help', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.HELP);
    });

    // /history command - delegates to conversation
    bot.command('history', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.HISTORY);
    });
  }

  /**
   * Register keyboard button handlers
   */
  private registerKeyboardHandlers(): void {
    const bot = this.grammyService.bot;

    // Handler for "🎨 Генерация" button
    bot.hears(KeyboardCommands.GENERATE, async (ctx) => {
      this.logger.log('[KEYBOARD] Generate button pressed');
      await ctx.conversation.enter(CommandEnum.GENERATE);
    });

    // Handler for "💰 Баланс" button
    bot.hears(KeyboardCommands.BALANCE, async (ctx) => {
      this.logger.log('[KEYBOARD] Balance button pressed');
      await ctx.conversation.enter(CommandEnum.BALANCE);
    });

    // Handler for "📜 История" button
    bot.hears(KeyboardCommands.HISTORY, async (ctx) => {
      this.logger.log('[KEYBOARD] History button pressed');
      await ctx.conversation.enter(CommandEnum.HISTORY);
    });

    // Handler for "❓ Помощь" button
    bot.hears(KeyboardCommands.HELP, async (ctx) => {
      this.logger.log('[KEYBOARD] Help button pressed');
      await ctx.conversation.enter(CommandEnum.HELP);
    });
  }

  /**
   * Register photo handler for image-to-image
   */
  private registerPhotoHandler(): void {
    const bot = this.grammyService.bot;

    bot.on('message:photo', async (ctx) => {
      // Photo handler implementation
      this.logger.log('Photo received for image-to-image generation');

      await ctx.reply(
        '🖼 Фото получено!\n\n' +
          'Функция Image-to-Image находится в разработке.\n' +
          'Скоро будет доступна!',
      );
    });
  }
}
