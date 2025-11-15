import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { hydrate } from '@grammyjs/hydrate';
import { MyContext, SessionData } from './telegram-context.interface';

/**
 * Factory function to create Grammy Bot instance
 */
export function createBot(token: string): Bot<MyContext> {
  const bot = new Bot<MyContext>(token);

  // Install hydration plugin
  bot.use(hydrate());

  // Install session plugin
  bot.use(
    session({
      initial: (): SessionData => ({
        messageId: undefined,
        generationId: undefined,
        lastPrompt: undefined,
        awaitingPhoto: false,
      }),
    }),
  );

  // Install conversations plugin
  bot.use(conversations());

  return bot;
}

/**
 * Provider for dependency injection
 */
export const BOT_TOKEN = 'BOT_TOKEN';
export const BOT_INSTANCE = 'BOT_INSTANCE';

export const botProvider = {
  provide: BOT_INSTANCE,
  useFactory: (token: string) => createBot(token),
  inject: [BOT_TOKEN],
};
