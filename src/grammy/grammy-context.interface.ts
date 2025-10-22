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
 * - Conversation support via ConversationFlavor
 * - Custom session data
 */
export type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context & SessionFlavor<SessionData>>;