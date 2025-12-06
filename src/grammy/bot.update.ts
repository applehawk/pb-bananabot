import {
  Injectable,
  Logger,
  OnModuleInit,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction } from 'grammy'; // Импортируем тип NextFunction
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
// import { TariffService } from '../tariff/tariff.service'; // Legacy VPN module
import { PrismaService } from '../database/prisma.service';
import { CommandEnum } from '../enum/command.enum';
import { getMainKeyboard } from './keyboards/main.keyboard';

import { GrammYServiceExtension } from './grammy-service-extension';

import { SubscriptionService } from './subscription.service';

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
    private readonly subscriptionService: SubscriptionService,
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
    this.registerMiddleware();
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
   * Register global middleware
   */
  private registerMiddleware(): void {
    const bot = this.grammyService.bot;

    bot.use(async (ctx, next) => {
      // Only check for private chats
      if (ctx.chat?.type !== 'private') {
        return next();
      }

      // Skip for admin
      if (this.isAdmin(ctx)) {
        return next();
      }

      // Skip for specific commands/callbacks if needed (e.g. /start to allow restart)
      // checking subscription on /start is actually good, but maybe we want to allow it?
      // User request: "before start of bot check". So yes, check always.

      // We need user ID. Upsert ensures user exists, but middleware runs early.
      // BotService.upsertUser is usually called in /start.
      // We might need to ensure user exists or just use telegram ID.
      // SubscriptionService uses telegram ID mostly.

      if (!ctx.from) return next();

      try {
        // We need DB ID for caching. If user not in DB, we can't check cache properly except failing.
        // But we can try to find user by Telegram ID.
        const user = await this.userService.findByTelegramId(ctx.from.id);
        if (!user) {
          // New user, let them pass to /start which creates user?
          // Or explicitly check?
          // If we block /start, they can't create account.
          // Let's allow /start to run first.
          if (ctx.message?.text === '/start') {
            return next();
          }
        }

        const userId = user?.id || ''; // If no user, we can't cache.

        const hasAccess = await this.subscriptionService.checkSubscriptionAccess(ctx, userId, BigInt(ctx.from.id));

        if (hasAccess) {
          return next();
        }

        // Access denied
        const channelId = await this.subscriptionService.getChannelId();
        const channelLink = channelId?.startsWith('@')
          ? `https://t.me/${channelId.substring(1)}`
          : `https://t.me/c/${channelId}`; // Approximate, ideally use invite link

        // Better link generation if possible, or just use ID text?
        // Usually channels are public usernames.

        await ctx.reply(
          '🚫 *Доступ ограничен!*\n\nДля использования бота необходимо подписаться на наш канал.',
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📢 Подписаться на канал', url: `https://t.me/${channelId?.replace('@', '')}` }
                ],
                [
                  { text: '✅ Я подписался', callback_data: 'check_subscription' }
                ]
              ]
            }
          }
        );

        // Stop propagation
        return;

      } catch (error) {
        this.logger.error('Error in subscription middleware', error);
        return next(); // Fail open if error
      }
    });

    // Handle the check button
    bot.callbackQuery('check_subscription', async (ctx) => {
      try {
        await ctx.answerCallbackQuery();
        const user = await this.userService.findByTelegramId(ctx.from.id);
        const userId = user?.id || '';
        const hasAccess = await this.subscriptionService.checkSubscriptionAccess(ctx, userId, BigInt(ctx.from.id));

        if (hasAccess) {
          await ctx.reply('✅ Спасибо! Подписка подтверждена. Вы можете пользоваться ботом.');
          // Optional: delete the block message?
          try { await ctx.deleteMessage(); } catch { }
        } else {
          await ctx.reply('❌ Вы все еще не подписаны на канал. Пожалуйста, подпишитесь и нажмите кнопку снова.');
        }
      } catch (error) {
        this.logger.error('Error in check_subscription callback', error);
      }
    });

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
    bot.on('callback_query:data', async (ctx, next) => {
      await this.handleCallbackQuery(ctx, next);
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
    const user = await this.userService.findByTelegramId(ctx.from!.id);
    const credits = Math.round(user?.credits || 0);

    const welcomeMessage = `🤖 *Добро пожаловать в @BananaArtBot!*

*Что я умею:*
🔹 _Текст_ → Уникальное изображение
🔹 _Фото + Текст_ → Генерация с учетом референса
🔹 _Несколько фото + Текст_ → Стиль и композиция из референсов

*Идеально подходит для:*
🎨 Обложек YouTube и постов в соцсетях
👗 Виртуальной примерки (фото + одежда + описание)
🛍 Продуктовых карточек и рекламы

💡 *Примеры запросов:*
• «YouTube-обложка, гаджеты, 4k»
• «Примерь эти очки на мне, реализм»
• «Флакон духов на фоне ночного города»

💎 Ваш баланс: *${credits} рублей*

🎯 *Фишка:* Бот умеет сохранять черты лица людей с ваших фото!

⚡ _Просто отправьте фото или текст, чтобы начать творить!_`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
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
  private async handleCallbackQuery(ctx: MyContext, next: NextFunction): Promise<void> {
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

      // Handle cancel purchase globally (PRIORITY)
      if (callbackData === 'cancel_purchase') {
        try {
          await ctx.deleteMessage();
          await ctx.answerCallbackQuery();
        } catch (e) {
          // ignore error if message already deleted
          await ctx.answerCallbackQuery().catch(() => { });
        }
        return;
      }

      // Check if callback data contains conversation-internal data (e.g., select_package:id, pay:method:id)
      // These should NOT trigger a new conversation - they're handled by waitFor() inside conversations
      const isConversationInternalData =
        callbackData.startsWith('select_package:') ||
        callbackData.startsWith('pay:') ||
        // callbackData === 'cancel_purchase' || // Handled globally above
        callbackData === 'back_to_packages' ||
        callbackData === 'generate_trigger' || // Handled by generate conversation
        callbackData.startsWith('aspect_') || // Handled by generate/settings conversation
        callbackData === 'save_settings' || // Handled by settings conversation
        callbackData === 'close_settings'; // Handled by settings conversation

      // Handle payment check globally (non-blocking)
      if (callbackData.startsWith('check_payment:')) {
        const paymentId = callbackData.split(':')[1];
        if (paymentId) {
          try {
            const isPaid = await ctx.paymentService.validatePayment(paymentId);
            if (isPaid) {
              await ctx.answerCallbackQuery({ text: '✅ Оплата получена! Кредиты начислены.' });
              // Optional: Update the message to show success state
              try {
                await ctx.editMessageText(`✅ <b>Оплата прошла успешно!</b>\nКредиты зачислены на ваш баланс.`, { parse_mode: 'HTML' });
              } catch (e) {
                // Ignore if message can't be edited
              }
            } else {
              await ctx.answerCallbackQuery({ text: '⏳ Оплата еще не поступила. Попробуйте через минуту.' });
            }
          } catch (error) {
            this.logger.error(`Error checking payment ${paymentId}`, error);
            await ctx.answerCallbackQuery({ text: '❌ Ошибка проверки платежа.' });
          }
        }
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
