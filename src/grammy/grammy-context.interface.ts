import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
import { TariffService } from '../tariff/tariff.service';
import { PaymentService } from '../payment/payment.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';

/**
 * Session data structure
 * Stores temporary conversation state between updates
 */
export interface SessionData {
  messageId?: number;
  tariffId?: string;
  generationId?: string;
  lastPrompt?: string;
  awaitingPhoto?: boolean;
}

/**
 * Custom context properties
 * Services injected by middleware
 */
export interface CustomContextProps {
  botService: BotService;
  userService: UserService;
  tariffService: TariffService;
  paymentService: PaymentService;
  // New services for image generation
  creditsService: CreditsService;
  generationService: GenerationService;
}

/**
 * Base context with session and custom properties
 */
type BaseContext = Context & SessionFlavor<SessionData> & CustomContextProps;

/**
 * Extended GrammY Context
 *
 * Combines:
 * - Base grammY Context
 * - Conversation support via ConversationFlavor
 * - Custom session data
 * - Custom service properties
 */
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;
