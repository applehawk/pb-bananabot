import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrammYService } from '../grammy/grammy.service';
import { CommandEnum } from '../enum/command.enum';
import { startConversation } from './start.conversation';
import { generateConversation } from './generate.conversation';
import { balanceConversation } from './balance.conversation';
import { helpConversation } from './help.conversation';
import { historyConversation } from './history.conversation';
import { buyCreditsConversation } from './buy-credits.conversation';

/**
 * Conversations Registry Service
 *
 * Registers all conversation flows with the bot
 * IMPORTANT: Must be initialized before BotUpdate to ensure conversations are registered
 * before bot.start() is called
 */
@Injectable()
export class ConversationsRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConversationsRegistryService.name);

  constructor(private readonly grammyService: GrammYService) {
    this.logger.log('ConversationsRegistryService constructor called');
  }

  /**
   * Register all conversations on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Registering conversations...');

    // Register START conversation
    this.grammyService.registerConversation(
      CommandEnum.START,
      startConversation,
    );

    // Register image generation conversations
    this.grammyService.registerConversation(
      CommandEnum.GENERATE,
      generateConversation,
    );
    this.grammyService.registerConversation(
      CommandEnum.BALANCE,
      balanceConversation,
    );
    this.grammyService.registerConversation(CommandEnum.HELP, helpConversation);
    this.grammyService.registerConversation(
      CommandEnum.HISTORY,
      historyConversation,
    );
    this.grammyService.registerConversation(
      CommandEnum.BUY_CREDITS,
      buyCreditsConversation,
    );

    this.logger.log('All conversations registered successfully');
  }
}
