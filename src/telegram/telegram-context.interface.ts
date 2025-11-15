import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';

/**
 * Session data structure
 */
export interface SessionData {
  messageId?: number;
  generationId?: string;
  lastPrompt?: string;
  awaitingPhoto?: boolean;
}

/**
 * Custom context properties
 * Services injected by middleware
 */
export interface CustomContextProps {
  userService: UserService;
  creditsService: CreditsService;
  generationService: GenerationService;
}

/**
 * Base context with session and custom properties
 */
type BaseContext = Context & SessionFlavor<SessionData> & CustomContextProps;

/**
 * Extended GrammY Context for Image Generation Bot
 *
 * Combines:
 * - Base grammY Context
 * - Conversation support via ConversationFlavor
 * - Custom session data
 * - Custom service properties
 */
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;
