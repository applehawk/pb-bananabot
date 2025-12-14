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
import { run, sequentialize } from '@grammyjs/runner';
import { RedisAdapter } from '@grammyjs/storage-redis';
import Redis from 'ioredis';
import { conversations, createConversation } from '@grammyjs/conversations';
import { hydrate } from '@grammyjs/hydrate';
import { MyContext, SessionData } from './grammy-context.interface';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
import { FSMService } from '../services/fsm/fsm.service';

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
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => FSMService))
    private readonly fsmService: FSMService,
    // @Inject(forwardRef(() => TariffService)) // Legacy VPN module
    // private readonly tariffService: TariffService,
    // @Inject(forwardRef(() => PaymentService)) // Legacy VPN module
    // private readonly paymentService: PaymentService,
  ) {
    const token = this.configService.get<string>('telegram.botToken');
    if (!token) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN not set in environment variables or configuration',
      );
    }

    this.bot = new Bot<MyContext>(token);
    this.useWebhook =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Initialize Redis
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');

    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.setupBasicMiddlewares();
    this.setupActivityTrackingMiddleware();
    this.setupServiceMiddlewares();
    this.setupHandlers();
  }

  /**
   * Setup basic bot middlewares (session and hydration)
   */
  private setupBasicMiddlewares(): void {
    // Session management - must be first
    // Using a session key version to invalidate old sessions after service injection changes

    // Sequentialize updates for the same chat to prevent race conditions (e.g. media groups)
    this.bot.use(sequentialize((ctx) => {
      const chat = ctx.chat?.id.toString();
      const user = ctx.from?.id.toString();
      return [chat, user].filter((v): v is string => v !== undefined);
    }));

    this.bot.use(
      session({
        initial: (): SessionData => ({
          messageId: undefined,
          tariffId: undefined,
          generationId: undefined,
          lastPrompt: undefined,
          awaitingPhoto: undefined,
          generationPrompt: undefined,
        }),
        storage: new RedisAdapter({ instance: this.redis }),
        getSessionKey: (ctx) => {
          // Add version to session key to invalidate old sessions
          const version = 'v3'; // Increment this to clear all sessions
          return ctx.chat?.id !== undefined
            ? `${ctx.chat.id}:${version}`
            : undefined;
        },
      }),
    );

    // Hydration - enables ctx.msg, ctx.chat shortcuts
    this.bot.use(hydrate());

    this.logger.log('Basic middlewares initialized');
  }

  /**
   * Setup service injection and conversations middleware
   * Called in constructor after all services are injected via DI
   */
  private setupServiceMiddlewares(): void {
    // Custom middleware to inject Nest services into context
    // IMPORTANT: Must be before conversations plugin so services are available during replay
    this.bot.use(async (ctx, next) => {
      // Make services available in conversation handlers
      ctx.botService = this.botService;
      ctx.userService = this.userService;
      ctx.fsmService = this.fsmService;
      // Legacy VPN services (disabled)
      // ctx.tariffService = this.tariffService;
      // ctx.paymentService = this.paymentService;
      await next();
    });

    // Conversations plugin
    // MOVED to onModuleInit to ensure it runs AFTER service injection extensions
    // this.bot.use(conversations());

    this.logger.log(
      'Service injection middlewares initialized',
    );
  }

  /**
   * Setup activity tracking middleware
   * Updates lastActiveAt in DB throttled by Redis (every 5 mins)
   */
  private setupActivityTrackingMiddleware(): void {
    this.bot.use(async (ctx, next) => {
      // Run mostly non-blocking, but wait for redis check so we don't start query if not needed?
      // Actually, we can let it run in background if we don't await next() immediately,
      // but we need to pass next().

      const nextPromise = next(); // Start processing next middleware

      if (ctx.from?.id) {
        const userId = ctx.from.id;
        const key = `user:activity_cooldown:${userId}`;

        // This can run in background parallel to next()
        this.redis.get(key).then(async (result) => {
          if (!result) {
            // Key missing, so update DB and set key
            try {
              await this.userService.updateLastActive(userId);
              // Set key with 5 minutes TTL (300 seconds)
              await this.redis.set(key, '1', 'EX', 300);
            } catch (e) {
              this.logger.warn(`Failed to update last active for ${userId}: ${e.message}`);
            }
          }
        }).catch(err => {
          this.logger.error('Redis error in activity middleware', err);
        });
      }

      await nextPromise;
    });

    this.logger.log('Activity tracking middleware initialized');
  }

  /**
   * Setup basic command handlers
   * Conversation-based scenes will be registered separately
   */
  private setupHandlers(): void {
    // Error handler
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(
        `Error while handling update ${ctx.update.update_id}:`,
        err.error,
      );
    });

    this.logger.log('Base handlers initialized');
  }

  /**
   * Register a conversation handler
   * Called by scene/conversation services during initialization
   * IMPORTANT: Must be called BEFORE bot.start()
   */
  public registerConversation(
    name: string,
    conversation: any,
    options?: any, // ConversationConfig
  ): void {
    this.logger.log(`Registering conversation: ${name}`);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const middleware = createConversation(conversation, options ? { id: name, ...options } : name);
    this.logger.log(`Created middleware for conversation: ${name}`);
    this.bot.use(middleware);
    this.logger.log(`Registered conversation middleware: ${name}`);
  }

  /**
   * Start bot - should be called AFTER conversations are registered
   */
  public async startBot(): Promise<void> {
    if (this.botStarted) {
      this.logger.warn('Bot already started, ignoring duplicate start call');
      return;
    }

    // Initialize bot to fetch bot info if not already initialized
    if (!this.bot.botInfo) {
      this.logger.log('Initializing bot...');
      await this.bot.init();
      this.logger.log('Bot initialized successfully');
    } else {
      this.logger.log('Bot already initialized (botInfo present)');
    }

    if (!this.useWebhook) {
      this.logger.log('Starting bot in polling mode (development) with runner');
      // Start polling with runner for concurrent updates
      run(this.bot);
      this.logger.log('Bot runner started in background');

      if (this.bot.botInfo) {
        this.logger.log(`Bot started: @${this.bot.botInfo.username} (${this.bot.botInfo.id})`);
      }
    } else {
      this.logger.log('Bot configured for webhook mode (production)');
      this.logger.warn('Remember to set webhook URL via setWebhook script');
    }

    this.botStarted = true;
  }

  /**
   * Module initialization
   * Middlewares and handlers are set up in constructor
   */
  async onModuleInit(): Promise<void> {
    // Conversations middleware is now registered in GrammYServiceExtension
    // to ensure it runs AFTER service injection

    this.logger.log(
      'GrammYService initialized. Starting bot initialization...',
    );

    // Initialize bot (fetch bot info) early to ensure it's ready for webhooks
    // This runs once the module is initialized, before the application starts listening
    try {
      await this.bot.init();
      this.logger.log(`Bot initialized: @${this.bot.botInfo.username}`);
    } catch (error) {
      this.logger.error('Failed to initialize bot during module init:', error);
      // We don't throw here to allow app to start, but webhook handling will fail
      // Ideally, we might want to throw if bot is critical
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
