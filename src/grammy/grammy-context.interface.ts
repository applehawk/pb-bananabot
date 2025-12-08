import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { BotService } from './bot.service';
import { UserService } from '../user/user.service';
// Legacy VPN modules (disabled)
// import { TariffService } from '../tariff/tariff.service';
import { PaymentService } from '../payment/payment.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';
import { GenerationMode } from '../enum/generation-mode.enum';

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
  generationPrompt?: string; // Prompt passed from command to conversation

  // Generation mode settings
  generationMode?: GenerationMode; // Current generation mode
  imageCount?: number; // Number of images to generate (for MULTI_IMAGE mode)
  quickBuy?: boolean; // Flag for quick purchase flow (skip steps)

  // Media group pre-collection (before entering conversation)
  mediaGroupPhotos?: string[]; // file_ids collected from media group
  mediaGroupCaption?: string; // Caption from media group

  // Stateless Generation Flow
  generationState?: {
    prompt: string;
    mode: GenerationMode;
    inputImageFileIds: string[];
    uiMessageId?: number;
    uiChatId?: number;
    aspectRatio?: string;
  };

  // Stateless Settings Flow
  settingsState?: {
    uiMessageId?: number;
    uiChatId?: number;
    draft?: {
      aspectRatio: string;
      hdQuality: boolean;
      askAspectRatio: boolean;
      selectedModelId: string;
    }
  };
}

/**
 * Custom context properties
 * Services injected by middleware
 */
export interface CustomContextProps {
  botService: BotService;
  userService: UserService;
  creditsService: CreditsService;
  generationService: GenerationService;
  paymentService: PaymentService;
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
