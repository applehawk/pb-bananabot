import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
// import { TariffService } from '../tariff/tariff.service'; // Legacy VPN module
import { PrismaService } from '../database/prisma.service';
import { CommandEnum } from '../enum/command.enum';
import { getMainKeyboard } from './keyboards/main.keyboard';

import { GrammYServiceExtension } from './grammy-service-extension';

/**
 * Bot Update Handler (grammY version)
 *
 * Registers all command handlers, callback query handlers, and text message handlers.
 * Replaces the old Telegraf @Update() decorator-based approach with direct grammY API.
 *
 * Note: This runs AFTER all OnModuleInit hooks in all modules thanks to OnApplicationBootstrap
 */
@Injectable()
export class BotUpdate implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(BotUpdate.name);
  private readonly adminChatId: number;


  constructor(
    private readonly grammyService: GrammYService,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    // private readonly tariffService: TariffService, // Legacy VPN module
    private readonly prisma: PrismaService,
    // Inject extension to force instantiation before BotUpdate runs
    private readonly grammyServiceExtension: GrammYServiceExtension,
  ) {
    this.logger.log('BotUpdate constructor called');
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }

  /**
   * Initialize all handlers after module initialization
   * Conversations are registered in ConversationsRegistryService.onModuleInit()
   */
  async onModuleInit(): Promise<void> {
    this.logger.log(
      'BotUpdate.onModuleInit() called',
    );
    // Handlers moved to onApplicationBootstrap to ensure they run AFTER conversations middleware
  }

  /**
   * Start bot after all modules are initialized
   * This ensures conversations are registered before bot starts processing updates
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(
      'BotUpdate.onApplicationBootstrap() - registering handlers and starting bot...',
    );

    // Register handlers HERE to ensure they run after conversations middleware
    // (which is registered in GrammYServiceExtension constructor or onModuleInit)
    this.registerCommands();
    this.registerCallbackHandlers();
    this.registerTextHandlers();
    this.registerPhotoHandlers();
    this.logger.log('Bot update handlers registered');

    // IMPORTANT: Start bot after all handlers AND conversations are registered
    await this.grammyService.startBot();
    this.logger.log('Bot started successfully');
  }

  /**
   * Register command handlers
   * Note: Image generation commands (/generate, /balance, /help, /history)
   * are registered in ImageGenService
   */
  private registerCommands(): void {
    const bot = this.grammyService.bot;

    // /start command
    bot.command('start', async (ctx) => {
      await this.handleStart(ctx);
    });

    // /buy and /buy_credits commands
    bot.command('buy', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.BUY_CREDITS);
    });
    bot.command('buy_credits', async (ctx) => {
      await ctx.conversation.enter(CommandEnum.BUY_CREDITS);
    });

    // Legacy VPN commands (disabled)
    // bot.command('tariff', async (ctx) => {
    //   await this.handleTariffCommand(ctx);
    // });

    // /up command (admin only)
    bot.command('up', async (ctx) => {
      await this.handleBalanceUpCommand(ctx);
    });

    // /setmenu command (admin only)
    bot.command('setmenu', async (ctx) => {
      await this.handleSetMenuCommand(ctx);
    });

    // /reset command - force clear all conversation state
    bot.command('reset', async (ctx) => {
      await this.handleResetCommand(ctx);
    });
  }

  /**
   * Register callback query (inline button) handlers
   */
  private registerCallbackHandlers(): void {
    const bot = this.grammyService.bot;

    // Handle all callback queries (inline button clicks)
    bot.on('callback_query:data', async (ctx) => {
      await this.handleCallbackQuery(ctx);
    });
  }

  /**
   * Register text message handlers
   */
  private registerTextHandlers(): void {
    const bot = this.grammyService.bot;

    // Handle all text messages
    bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });
  }

  /**
   * Register photo message handlers
   */
  private registerPhotoHandlers(): void {
    const bot = this.grammyService.bot;

    // Handle photo messages
    bot.on('message:photo', async (ctx) => {
      await this.handlePhotoMessage(ctx);
    });
  }

  /**
   * Photo message handler
   * Simply enters the generation conversation.
   * The conversation itself handles multiple photos (media groups).
   */
  private async handlePhotoMessage(ctx: MyContext): Promise<void> {
    try {
      if (ctx.chat?.type !== 'private') return;

      const photo = ctx.message?.photo;
      if (!photo || photo.length === 0) return;

      // Check if conversation is already active to prevent restarting it
      // This handles the case where multiple photos (album) are sent
      const active = await ctx.conversation.active();
      if (active[CommandEnum.GENERATE]) {
        this.logger.log('Generate conversation already active, skipping enter() for additional photo');
        return;
      }

      // The conversation will check ctx.message for the first photo
      // and then wait for subsequent photos if it's a media group
      await ctx.conversation.enter(CommandEnum.GENERATE);
    } catch (error) {
      this.logger.error('Error handling photo message:', error);
    }
  }

  /**
   * /start command handler
   */
  private async handleStart(ctx: MyContext): Promise<void> {
    // Only allow private chats
    if (ctx.chat?.type !== 'private') {
      await ctx.reply(
        'Для работы с ботом, нужно писать ему в личные сообщения',
        {
          reply_markup: { remove_keyboard: true },
        },
      );
      return;
    }

    // Reset session
    ctx.session = {
      messageId: undefined,
      tariffId: undefined,
    };

    // Upsert user
    await this.botService.upsertUser(ctx);

    // Send Welcome Message
    const credits = (await this.userService.findByTelegramId(ctx.from!.id))?.credits || 0;

    const welcomeMessage = `🤖 Добро пожаловать в **@BananaArtBot**!

Что я умею:
• Напишите текст → получите изображение
• Фото + текст → изображение с учетом референса и описания
• Несколько фото + текст → изображение в стиле/составе референсов

Подходит для:
• обложек *YouTube*
• *виртуальной примерки (ваше фото + аксессуары + текст с описанием сцены)* (Instagram—стиль)
• продуктовых *Instagram—постов*
• *рекламных креативов* для Telegram и соцсетей

💡 Примеры:
• «YouTube—обложка, тема гаджеты»
• «примерь эти очки на мне»
• «премиальная карточка парфюма»
• «креатив для рекламы доставки»

⚡ *Отправьте фото и текст — и начните прямо сейчас!* 

💎 Баланс: **${credits}** кредитов

🎯 Особенность: Бот анализирует людей на ваших фотографиях и создает новые изображения с теми же людьми в новых сценариях!

⚡ Начните прямо сейчас — отправьте фото с промптом!`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(),
    });
  }

  /**
   * /up command handler (admin only)
   * Usage: /up <username> <amount>
   */
  private async handleBalanceUpCommand(ctx: MyContext): Promise<void> {
    if (!this.isAdmin(ctx)) {
      return;
    }

    try {
      const matchText = typeof ctx.match === 'string' ? ctx.match : '';
      const args = matchText.split(' ').filter(Boolean) || [];
      const [username, changeStr] = args;

      if (!username || !changeStr || Number.isNaN(parseInt(changeStr))) {
        throw new Error(
          'Не указан один из обязательных параметров или указан неверно!',
        );
      }

      const changeInt = parseInt(changeStr);

      // Find user by username
      const user = await this.prisma.user.findFirst({
        where: { username },
      });

      if (!user) {
        throw new Error(`Пользователь ${username} не найден`);
      }

      // Update credits
      await this.userService.updateCredits(user.id, changeInt);

      await this.grammyService.bot.api.sendMessage(
        this.adminChatId,
        `Пополнен баланс на ${changeInt} кредитов для @${username}`,
      );
    } catch (error) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
  }

  /**
   * /setmenu command handler (web app menu button)
   */
  private async handleSetMenuCommand(ctx: MyContext): Promise<void> {
    const WEB_APP_URL = 'https://feathers.studio/telegraf/webapp/example';

    await ctx.api.setChatMenuButton({
      chat_id: ctx.chat?.id,
      menu_button: {
        type: 'web_app',
        text: 'Launch',
        web_app: { url: WEB_APP_URL },
      },
    });

    await ctx.reply('✅ Menu button set');
  }

  /**
   * /reset command handler
   * Completely clears session and conversation state
   */
  private async handleResetCommand(ctx: MyContext): Promise<void> {
    // Reset the entire session object to clear conversation state
    ctx.session = {
      messageId: undefined,
      tariffId: undefined,
    };

    await ctx.reply('✅ Session reset! Please send /start to begin fresh.');
  }

  /**
   * Callback query handler (inline keyboard buttons)
   */
  private async handleCallbackQuery(ctx: MyContext): Promise<void> {
    try {
      // Only handle private chats
      if (ctx.chat?.type !== 'private') {
        return;
      }

      const callbackData = ctx.callbackQuery?.data;
      if (!callbackData) {
        return;
      }

      const updateId = ctx.update.update_id;
      this.logger.log(`[handleCallbackQuery] Update ID: ${updateId}, Callback: ${callbackData}`);

      // Check if callback data contains conversation-internal data (e.g., select_package:id, pay:method:id)
      // These should NOT trigger a new conversation - they're handled by waitFor() inside conversations
      const isConversationInternalData =
        callbackData.startsWith('select_package:') ||
        callbackData.startsWith('pay:') ||
        callbackData.startsWith('check_payment:') ||
        callbackData === 'cancel_purchase' ||
        callbackData === 'back_to_packages' ||
        callbackData === 'generate_trigger' || // Handled by generate conversation
        callbackData.startsWith('aspect_') || // Handled by generate/settings conversation
        callbackData === 'save_settings' || // Handled by settings conversation
        callbackData === 'close_settings'; // Handled by settings conversation

      // If this is internal conversation data, don't try to enter a conversation
      // The active conversation's waitFor() will handle it
      if (isConversationInternalData) {
        this.logger.log(`Callback is conversation-internal data, letting active conversation handle it`);
        return;
      }

      // Handle regeneration specially
      if (callbackData.startsWith('regenerate_')) {
        await ctx.conversation.enter(CommandEnum.GENERATE);
        return;
      }

      // Answer callback query to remove loading state
      await ctx.answerCallbackQuery();

      // Enter the conversation/scene based on callback data
      // The conversation name should match the CommandEnum value
      this.logger.log(`Entering conversation: ${callbackData}`);
      await ctx.conversation.enter(callbackData);
    } catch (error) {
      this.logger.error('Error handling callback query:', error);
    }
  }

  /**
   * Text message handler
   */
  private async handleTextMessage(ctx: MyContext): Promise<void> {
    try {
      // Only handle private chats
      if (ctx.chat?.type !== 'private') {
        return;
      }

      this.logger.log(`Text message: ${ctx.message?.text}`);

      const messageText = ctx.message?.text;

      // Handle Main Keyboard Buttons
      if (messageText === '💰 Баланс') {
        await ctx.conversation.enter(CommandEnum.BALANCE);
        return;
      }
      if (messageText === '📜 История') {
        await ctx.conversation.enter(CommandEnum.HISTORY);
        return;
      }
      if (messageText === '❓ Помощь') {
        await ctx.conversation.enter(CommandEnum.HELP);
        return;
      }
      if (messageText === '⚙️ Настройки') {
        await ctx.conversation.enter(CommandEnum.SETTINGS);
        return;
      }
      if (messageText === '💎 Купить кредиты') {
        await ctx.conversation.enter(CommandEnum.BUY_CREDITS);
        return;
      }

      // Check if text matches any button text and enter corresponding scene
      if (messageText === '📱в меню') {
        // Special handling for HOME button
        const existUser = await this.userService.findByTelegramId(ctx.from?.id);
        if (existUser) {
          await ctx.conversation.enter(CommandEnum.HOME);
        } else {
          await this.handleStart(ctx);
        }
        return;
      }

      // If it's not a command and not a button, assume it's a prompt for generation
      if (messageText && !messageText.startsWith('/')) {
        await ctx.conversation.enter(CommandEnum.GENERATE);
      }

    } catch (error) {
      this.logger.error('Error handling text message:', error);
    }
  }

  /**
   * Check if user is admin
   */
  private isAdmin(ctx: MyContext): boolean {
    return ctx.chat?.id === this.adminChatId;
  }
}
