import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GrammYService } from '../grammy/grammy.service';
import { CommandEnum } from '../enum/command.enum';
import { GrammYServiceExtension } from '../grammy/grammy-service-extension';
// import { generateConversation } from './generate.conversation';
import { balanceConversation } from './balance.conversation';
import { helpConversation } from './help.conversation';
import { historyConversation } from './history.conversation';
import { buyCreditsConversation } from './buy-credits.conversation';
import { bonusesConversation, transferConversation } from './bonuses.conversation';


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

  constructor(
    private readonly grammyService: GrammYService,
    // Inject extension to ensure conversations() middleware is installed BEFORE conversations are registered
    private readonly grammyServiceExtension: GrammYServiceExtension,
  ) {
    this.logger.log('ConversationsRegistryService constructor called');
  }

  /**
   * Register all conversations on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Registering conversations...');

    // Register other conversations
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
      { parallel: true },
    );

    this.grammyService.registerConversation(
      CommandEnum.BONUSES,
      bonusesConversation,
    );

    this.grammyService.registerConversation(
      CommandEnum.TRANSFER,
      transferConversation,
    );

    // Register GENERATE conversation (Last, so others are registered before it captures context)
    // GENERATE conversation removed (refactored to stateless flow)

    this.logger.log('All conversations registered successfully');
  }
}
