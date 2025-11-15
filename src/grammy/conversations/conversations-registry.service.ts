import { Injectable, OnModuleInit, OnApplicationBootstrap, Logger, Inject, forwardRef } from '@nestjs/common';
import { GrammYService } from '../grammy.service';
import { CommandEnum } from '../../enum/command.enum';
import * as conversations from './index';

/**
 * Conversations Registry Service
 *
 * Registers all conversation handlers with the GrammY bot.
 * Must be initialized after GrammYService.
 */
@Injectable()
export class ConversationsRegistryService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(ConversationsRegistryService.name);

  constructor(
    @Inject(forwardRef(() => GrammYService))
    private readonly grammyService: GrammYService,
  ) {
    this.logger.log('ConversationsRegistryService constructor called');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('ConversationsRegistryService.onModuleInit() called');
    // Register conversations in onModuleInit to ensure GrammYService is fully initialized
    this.logger.log('Registering conversations...');
    this.registerConversations();
    this.logger.log('All conversations registered');
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('ConversationsRegistryService.onApplicationBootstrap() called - starting bot...');
    // Start the bot AFTER all modules are initialized and conversations are registered
    this.grammyService.startBot();
    this.logger.log('Bot started successfully after all initialization');
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
}