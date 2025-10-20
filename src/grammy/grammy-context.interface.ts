import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';

/**
 * Session data structure
 * Stores temporary conversation state between updates
 */
export interface SessionData {
  messageId?: number;
  tariffId?: string;
}

/**
 * Extended GrammY Context
 *
 * Combines:
 * - Base grammY Context
 * - Session management via SessionFlavor
 * - Conversation support via ConversationFlavor
 */
export interface MyContext extends Context, SessionFlavor<SessionData>, ConversationFlavor {}