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
import { TariffService } from '../tariff/tariff.service';
import { PaymentService } from '../payment/payment.service';

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
  private botStarted = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => TariffService))
    private readonly tariffService: TariffService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {
    const token = this.configService.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN not set in environment variables');
    }

    this.bot = new Bot<MyContext>(token);
    this.useWebhook = this.configService.get<string>('NODE_ENV') === 'production';

    this.setupBasicMiddlewares();
    this.setupHandlers();
  }

  /**
   * Setup basic bot middlewares (session and hydration)
   * Service injection and conversations will be added later in onModuleInit
   */
  private setupBasicMiddlewares(): void {
    // Session management - must be first
    // Using a session key version to invalidate old sessions after service injection changes
    this.bot.use(
      session({
        initial: (): { messageId?: number; tariffId?: string } => ({
          messageId: undefined,
          tariffId: undefined,
        }),
        getSessionKey: (ctx) => {
          // Add version to session key to invalidate old sessions
          const version = 'v2'; // Increment this to clear all sessions
          return ctx.chat?.id !== undefined ? `${ctx.chat.id}:${version}` : undefined;
        },
      }),
    );

    // Hydration - enables ctx.msg, ctx.chat shortcuts
    this.bot.use(hydrate());

    this.logger.log('Basic middlewares initialized');
  }

  /**
   * Setup service injection and conversations middleware
   * Called in onModuleInit after all services are injected
   */
  private setupServiceMiddlewares(): void {
    // Custom middleware to inject Nest services into context
    // IMPORTANT: Must be before conversations plugin so services are available during replay
    this.bot.use(async (ctx, next) => {
      // Make services available in conversation handlers
      ctx.botService = this.botService;
      ctx.userService = this.userService;
      ctx.tariffService = this.tariffService;
      ctx.paymentService = this.paymentService;
      await next();
    });

    // Conversations plugin
    this.bot.use(conversations());

    this.logger.log('Service injection and conversations middlewares initialized');
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
   * IMPORTANT: Must be called BEFORE bot.start()
   */
  public registerConversation(name: string, conversation: any): void {
    this.logger.log(`Registering conversation: ${name}`);
    const middleware = createConversation(conversation, name);
    this.logger.log(`Created middleware for conversation: ${name}`);
    this.bot.use(middleware);
    this.logger.log(`Registered conversation middleware: ${name}`);
  }

  /**
   * Start bot - should be called AFTER conversations are registered
   */
  public startBot(): void {
    if (this.botStarted) {
      this.logger.warn('Bot already started, ignoring duplicate start call');
      return;
    }

    if (!this.useWebhook) {
      this.logger.log('Starting bot in polling mode (development)');
      // Start polling without blocking - don't await
      this.bot.start({
        onStart: (info) => {
          this.logger.log(`Bot started: @${info.username} (${info.id})`);
        },
      });
      this.logger.log('Bot polling started in background');
    } else {
      this.logger.log('Bot configured for webhook mode (production)');
      this.logger.warn('Remember to set webhook URL via setWebhook script');
    }

    this.botStarted = true;
  }

  /**
   * Module initialization
   * Set up service injection and conversations middleware after all services are injected
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('GrammYService.onModuleInit() - setting up service middlewares');
    this.setupServiceMiddlewares();
    this.logger.log('GrammYService initialized (bot not started yet - waiting for conversations)');
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