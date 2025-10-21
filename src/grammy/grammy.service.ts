import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { hydrate } from '@grammyjs/hydrate';
import { MyContext } from './grammy-context.interface';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';

/**
 * GrammY Service
 *
 * Core service that manages the GrammY Bot lifecycle:
 * - Initializes bot with token from environment
 * - Sets up middleware (session, hydration, conversations)
 * - Registers command handlers and conversation flows
 * - Manages bot startup/shutdown
 */
@Injectable()
export class GrammYService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrammYService.name);
  public bot: Bot<MyContext>;
  private readonly useWebhook: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN not set in environment variables');
    }

    this.bot = new Bot<MyContext>(token);
    this.useWebhook = this.configService.get<string>('NODE_ENV') === 'production';

    this.setupMiddlewares();
    this.setupHandlers();
  }

  /**
   * Setup bot middlewares
   * Order matters: session must come before conversations
   */
  private setupMiddlewares(): void {
    // Session management - must be first
    this.bot.use(
      session({
        initial: (): { messageId?: number; tariffId?: string } => ({
          messageId: undefined,
          tariffId: undefined,
        }),
      }),
    );

    // Hydration - enables ctx.msg, ctx.chat shortcuts
    this.bot.use(hydrate());

    // Conversations plugin
    this.bot.use(conversations());

    // Custom middleware to inject Nest services into context
    this.bot.use(async (ctx, next) => {
      // Make services available in conversation handlers if needed
      (ctx as any).botService = this.botService;
      (ctx as any).userService = this.userService;
      await next();
    });

    this.logger.log('Middlewares initialized');
  }

  /**
   * Setup basic command handlers
   * Conversation-based scenes will be registered separately
   */
  private setupHandlers(): void {
    // Error handler
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
    });

    this.logger.log('Base handlers initialized');
  }

  /**
   * Register a conversation handler
   * Called by scene/conversation services during initialization
   */
  public registerConversation(name: string, conversation: any): void {
    this.bot.use(createConversation(conversation, name));
    this.logger.log(`Registered conversation: ${name}`);
  }

  /**
   * Start bot based on environment
   * - Development: Long polling
   * - Production: Webhook (started externally via WebhookController)
   */
  async onModuleInit(): Promise<void> {
    if (!this.useWebhook) {
      this.logger.log('Starting bot in polling mode (development)');
      await this.bot.start({
        onStart: (info) => {
          this.logger.log(`Bot started: @${info.username} (${info.id})`);
        },
      });
    } else {
      this.logger.log('Bot configured for webhook mode (production)');
      this.logger.warn('Remember to set webhook URL via setWebhook script');
    }
  }

  /**
   * Graceful shutdown
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Stopping bot...');
    await this.bot.stop();
    this.logger.log('Bot stopped');
  }
}