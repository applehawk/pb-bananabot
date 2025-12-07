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
    this.logger.log('Image generation commands registered');
  }

  /**
   * Register image generation commands
   */
  private registerCommands(): void {
    const bot = this.grammyService.bot;

    // Note: /generate is now handled within the START conversation
    // Users can send text/photos directly without needing a separate command

    // /balance command - delegates to conversation
    // bot.command('balance', async (ctx) => {
    //   await ctx.conversation.enter(CommandEnum.BALANCE);
    // });

    bot.command('bonuses', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.BONUSES);
    });

    // /help command - delegates to conversation
    bot.command('help', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.HELP);
    });

    // /history command - delegates to conversation
    // bot.command('history', async (ctx) => {
    //   await ctx.conversation.enter(CommandEnum.HISTORY);
    // });

    // /history command - delegates to conversation
    bot.command('bonuses', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.BONUSES);
    });
  }

  /**
   * Register keyboard button handlers
   */
  private registerKeyboardHandlers(): void {
    const bot = this.grammyService.bot;

    // Note: Generate button has been removed from keyboard
    // Users can now directly send text/photos for generation

    // Handler for "💰 Баланс" button
    bot.hears(KeyboardCommands.BUY_CREDITS, async (ctx) => {
      this.logger.log('[KEYBOARD] Balance button pressed');
      await ctx.conversation.enter(CommandEnum.BUY_CREDITS);
    });

    // Handler for "📜 История" button
    bot.hears(KeyboardCommands.BONUSES, async (ctx) => {
      this.logger.log('[KEYBOARD] History button pressed');
      await ctx.conversation.enter(CommandEnum.BONUSES);
    });

    // Handler for "❓ Помощь" button
    bot.hears(KeyboardCommands.HELP, async (ctx) => {
      this.logger.log('[KEYBOARD] Help button pressed');
      await ctx.conversation.enter(CommandEnum.HELP);
    });
  }

}
