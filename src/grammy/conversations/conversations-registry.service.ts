import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { GrammYService } from '../grammy.service';
import { CommandEnum } from '../../enum/command.enum';
import * as conversations from './index';
import { PaymentService } from '../../payment/payment.service';
import { TariffService } from '../../tariff/tariff.service';

/**
 * Conversations Registry Service
 *
 * Registers all conversation handlers with the GrammY bot.
 * Must be initialized after GrammYService.
 */
@Injectable()
export class ConversationsRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConversationsRegistryService.name);

  constructor(
    @Inject(forwardRef(() => GrammYService))
    private readonly grammyService: GrammYService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => TariffService))
    private readonly tariffService: TariffService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerConversations();
    this.injectServicesIntoContext();
    this.logger.log('All conversations registered');
  }

  /**
   * Register all conversation handlers
   */
  private registerConversations(): void {
    // Register each conversation with its CommandEnum name
    this.grammyService.registerConversation(CommandEnum.START, conversations.startConversation);
    this.grammyService.registerConversation(CommandEnum.HOME, conversations.homeConversation);
    this.grammyService.registerConversation(CommandEnum.STATUS, conversations.statusConversation);
    this.grammyService.registerConversation(
      CommandEnum.QUESTION,
      conversations.questionConversation,
    );
    this.grammyService.registerConversation(
      CommandEnum.GET_ACCESS,
      conversations.getAccessConversation,
    );
    this.grammyService.registerConversation(CommandEnum.PAYMENT, conversations.paymentConversation);
    this.grammyService.registerConversation(
      CommandEnum.MONTH_TARIFF,
      conversations.monthTariffConversation,
    );
    this.grammyService.registerConversation(
      CommandEnum.THREEMONTH_TARIFF,
      conversations.threeMonthTariffConversation,
    );
    this.grammyService.registerConversation(
      CommandEnum.SIXMONTH_TARIFF,
      conversations.sixMonthTariffConversation,
    );
  }

  /**
   * Inject services into context for use in conversations
   */
  private injectServicesIntoContext(): void {
    const bot = this.grammyService.bot;

    bot.use(async (ctx, next) => {
      // Make services available in conversation handlers
      (ctx as any).paymentService = this.paymentService;
      (ctx as any).tariffService = this.tariffService;
      await next();
    });

    this.logger.log('Services injected into context');
  }
}