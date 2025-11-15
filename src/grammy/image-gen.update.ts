import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';
import { UserService } from '../user/user.service';

/**
 * Image Generation Update Handler
 *
 * Регистрирует все команды и handlers для генерации изображений
 */
@Injectable()
export class ImageGenUpdate implements OnModuleInit {
  private readonly logger = new Logger(ImageGenUpdate.name);

  constructor(
    private readonly grammyService: GrammYService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly generationService: GenerationService,
  ) {
    this.logger.log('ImageGenUpdate constructor called');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(
      'ImageGenUpdate.onModuleInit() - registering image gen handlers...',
    );
    this.registerImageGenCommands();
    this.registerPhotoHandler();
    this.registerTextHandler();
    this.logger.log('Image generation handlers registered');
  }

  /**
   * Register image generation commands
   */
  private registerImageGenCommands(): void {
    const bot = this.grammyService.bot;

    // /generate command
    bot.command('generate', async (ctx) => {
      const prompt = ctx.match as string;

      if (!prompt || prompt.trim().length === 0) {
        return ctx.reply(
          `💡 Укажите описание изображения после команды.\n\n` +
            `Пример:\n` +
            `/generate Futuristic city at sunset\n\n` +
            `Или просто отправьте текстовое сообщение без команды.`,
        );
      }

      await this.handleGeneration(ctx, prompt.trim());
    });

    // /balance command
    bot.command('balance', async (ctx) => {
      await this.handleBalance(ctx);
    });

    // /help command
    bot.command('help', async (ctx) => {
      await this.handleHelp(ctx);
    });

    // /history command
    bot.command('history', async (ctx) => {
      await this.handleHistory(ctx);
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

  /**
   * Register text handler for prompt-based generation
   */
  private registerTextHandler(): void {
    const bot = this.grammyService.bot;

    // This handler will catch text messages that aren't commands
    // But we need to be careful not to override existing handlers
    // So we'll only handle specific patterns or use it as fallback
  }

  /**
   * Handle text-to-image generation
   */
  private async handleGeneration(
    ctx: MyContext,
    prompt: string,
  ): Promise<void> {
    try {
      const user = await ctx.userService.findByTelegramId(ctx.from.id);

      if (!user) {
        await ctx.botService.upsertUser(ctx);
        return ctx.reply(
          '👋 Добро пожаловать! Вы зарегистрированы.\n' +
            'Попробуйте ещё раз: /generate ' +
            prompt,
        );
      }

      // Calculate cost
      const cost = ctx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);

      // Check credits
      if (user.credits < cost) {
        return ctx.reply(
          `💎 Недостаточно кредитов\n\n` +
            `Требуется: ${cost}\n` +
            `Доступно: ${user.credits}\n\n` +
            `Пополните баланс: /buy`,
        );
      }

      // Send processing message
      const statusMsg = await ctx.reply(
        `🎨 Генерирую изображение...\n⏱ Подождите 5-10 секунд\n\n` +
          `Промпт: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
      );

      try {
        // Generate image
        const generation = await ctx.generationService.generateTextToImage({
          userId: user.id,
          prompt,
        });

        // Delete status message
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

        // Send result
        const caption =
          `🎨 ${prompt}\n\n` +
          `💎 Использовано: ${cost} кредитов\n` +
          `💰 Осталось: ${user.credits - cost} кредитов\n` +
          `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

        // Use fileId or URL
        const imageSource = generation.fileId || generation.imageUrl;

        if (imageSource) {
          await ctx.replyWithPhoto(imageSource, { caption });
        } else if (generation.imageData) {
          // Fallback to base64
          const buffer = Buffer.from(generation.imageData, 'base64');
          await ctx.replyWithPhoto({ source: buffer }, { caption });
        } else {
          await ctx.reply(`✅ Изображение сгенерировано, но ошибка отправки.`);
        }
      } catch (error) {
        await ctx.api
          .deleteMessage(ctx.chat.id, statusMsg.message_id)
          .catch(() => {});

        this.logger.error('Generation error:', error);

        await ctx.reply(
          `❌ Ошибка при генерации изображения\n\n` +
            `${error.message}\n\n` +
            `Попробуйте изменить промпт или повторить позже.`,
        );
      }
    } catch (error) {
      this.logger.error('Command error:', error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  /**
   * Handle /balance command
   */
  private async handleBalance(ctx: MyContext): Promise<void> {
    try {
      const user = await ctx.userService.findByTelegramId(ctx.from.id);

      if (!user) {
        return ctx.reply(
          '❌ Пользователь не найден. Используйте /start для регистрации.',
        );
      }

      const stats = await ctx.userService.getStatistics(user.id);
      const transactions = await ctx.creditsService.getTransactionHistory(
        user.id,
        5,
      );

      let message = `💰 **Ваш баланс**\n\n`;
      message += `💎 Кредиты: **${user.credits.toFixed(1)}**\n`;
      message += `🎨 Всего сгенерировано: ${user.totalGenerated}\n`;
      message += `📅 Участник с: ${user.createdAt.toLocaleDateString('ru-RU')}\n\n`;

      if (transactions.length > 0) {
        message += `📜 **Последние операции:**\n`;
        for (const tx of transactions.slice(0, 5)) {
          const emoji = tx.creditsAdded > 0 ? '➕' : '➖';
          const credits = Math.abs(tx.creditsAdded).toFixed(1);
          message += `${emoji} ${this.getTransactionTypeName(tx.type)}: ${credits}\n`;
        }
        message += `\n`;
      }

      message += `💵 **Стоимость:**\n`;
      message += `• Text-to-Image: 1 кредит\n`;
      message += `• Image-to-Image: 1.5 кредита\n`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Balance command error:', error);
      await ctx.reply('❌ Ошибка при получении баланса.');
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelp(ctx: MyContext): Promise<void> {
    const helpMessage =
      `🤖 **AI Image Generator Bot**\n\n` +
      `**Команды:**\n` +
      `/generate [описание] - Сгенерировать изображение\n` +
      `/balance - Проверить баланс\n` +
      `/history - История генераций\n` +
      `/help - Эта справка\n\n` +
      `**Примеры:**\n` +
      `✨ "Magical forest with glowing mushrooms"\n` +
      `🌆 "Cyberpunk street at night"\n` +
      `🎨 "Oil painting of mountains"\n\n` +
      `Просто отправьте текст для генерации!`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /history command
   */
  private async handleHistory(ctx: MyContext): Promise<void> {
    try {
      const user = await ctx.userService.findByTelegramId(ctx.from.id);

      if (!user) {
        return ctx.reply('❌ Пользователь не найден.');
      }

      const history = await ctx.generationService.getHistory(user.id, 10);

      if (history.length === 0) {
        return ctx.reply(
          '📜 История пуста.\n\nИспользуйте /generate для создания первого изображения!',
        );
      }

      let message = `📜 **История генераций**\n\n`;
      message += `Последние ${history.length} генераций:\n\n`;

      for (const gen of history) {
        const date = gen.createdAt.toLocaleDateString('ru-RU');
        const prompt =
          gen.prompt.length > 50
            ? gen.prompt.substring(0, 50) + '...'
            : gen.prompt;

        message += `🎨 ${prompt}\n`;
        message += `📅 ${date} | 💎 ${gen.creditsUsed}\n\n`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('History command error:', error);
      await ctx.reply('❌ Ошибка при получении истории.');
    }
  }

  private getTransactionTypeName(type: string): string {
    const names: Record<string, string> = {
      PURCHASE: 'Покупка',
      BONUS: 'Бонус',
      REFERRAL: 'Реферал',
      DAILY_BONUS: 'Ежедневный',
      GENERATION_COST: 'Генерация',
      REFUND: 'Возврат',
    };
    return names[type] || type;
  }
}
