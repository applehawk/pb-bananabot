import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrammYService } from './grammy.service';
import { MyContext } from './grammy-context.interface';
import { BotService } from '../bot.service';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';
import { BalanceChangeTypeEnum } from '../payment/enum/balancechange-type.enum';
import { CommandEnum } from '../enum/command.enum';
import { InlineKeyboard } from 'grammy';

/**
 * Bot Update Handler (grammY version)
 *
 * Registers all command handlers, callback query handlers, and text message handlers.
 * Replaces the old Telegraf @Update() decorator-based approach with direct grammY API.
 */
@Injectable()
export class BotUpdate implements OnModuleInit {
  private readonly logger = new Logger(BotUpdate.name);
  private readonly adminChatId: number;

  constructor(
    private readonly grammyService: GrammYService,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
  ) {
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }

  /**
   * Initialize all handlers after module initialization
   */
  async onModuleInit(): Promise<void> {
    this.registerCommands();
    this.registerCallbackHandlers();
    this.registerTextHandlers();
    this.logger.log('Bot update handlers registered');
  }

  /**
   * Register command handlers
   */
  private registerCommands(): void {
    const bot = this.grammyService.bot;

    // /start command
    bot.command('start', async (ctx) => {
      await this.handleStart(ctx);
    });

    // /tariff command (admin only)
    bot.command('tariff', async (ctx) => {
      await this.handleTariffCommand(ctx);
    });

    // /up command (admin only)
    bot.command('up', async (ctx) => {
      await this.handleBalanceUpCommand(ctx);
    });

    // /setmenu command (admin only)
    bot.command('setmenu', async (ctx) => {
      await this.handleSetMenuCommand(ctx);
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
   * /start command handler
   */
  private async handleStart(ctx: MyContext): Promise<void> {
    // Only allow private chats
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }

    // Reset session
    ctx.session.messageId = undefined;
    ctx.session.tariffId = undefined;

    // Upsert user
    await this.botService.upsertUser(ctx);

    // Enter START conversation
    await ctx.conversation.enter('start');
  }

  /**
   * /tariff command handler (admin only)
   * Usage: /tariff <name> <price>
   */
  private async handleTariffCommand(ctx: MyContext): Promise<void> {
    if (!this.isAdmin(ctx)) {
      return;
    }

    try {
      const args = ctx.match?.split(' ').filter(Boolean) || [];
      const [tariffName, priceStr] = args;

      if (!tariffName || !priceStr || Number.isNaN(parseInt(priceStr))) {
        throw new Error('Не указан один из обязательных параметров или указан неверно!');
      }

      const price = parseInt(priceStr);
      await this.tariffService.updateTariffPrice(tariffName, price);
      await ctx.reply(`✅ Тариф "${tariffName}" обновлен. Новая цена: ${price} руб.`);
    } catch (error) {
      await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
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
      const args = ctx.match?.split(' ').filter(Boolean) || [];
      const [username, changeStr] = args;

      if (!username || !changeStr || Number.isNaN(parseInt(changeStr))) {
        throw new Error('Не указан один из обязательных параметров или указан неверно!');
      }

      const changeInt = parseInt(changeStr);
      const user = await this.userService.findUserByUsername(username);
      const balanceChange = await this.userService.commitBalanceChange(
        user,
        changeInt,
        BalanceChangeTypeEnum.MANUALLY,
      );

      await this.grammyService.bot.api.sendMessage(
        this.adminChatId,
        `Пополнен баланс на ${balanceChange.changeAmount}, статус пополнения: ${balanceChange.status}`,
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

      this.logger.log(`Callback query: ${callbackData}`);

      // Answer callback query to remove loading state
      await ctx.answerCallbackQuery();

      // Enter the conversation/scene based on callback data
      // The conversation name should match the CommandEnum value
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

      // Update user chatId if not set
      const user = await this.userService.findOneByUserId(ctx.from?.id);
      if (user && !user.chatId) {
        await this.userService.updateUser({
          where: { userId: user.userId },
          data: { chatId: ctx.chat?.id },
        });
      }

      this.logger.log(`Text message: ${ctx.message?.text}`);

      // Check if text matches any button text and enter corresponding scene
      const messageText = ctx.message?.text;
      if (messageText === '📱в меню') {
        // Special handling for HOME button
        const existUser = await this.userService.findOneByUserId(ctx.from?.id);
        if (existUser) {
          await ctx.conversation.enter(CommandEnum.HOME);
        } else {
          await ctx.conversation.enter(CommandEnum.START);
        }
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