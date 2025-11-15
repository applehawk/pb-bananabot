import { Composer } from 'grammy';
import { MyContext } from '../telegram-context.interface';
import { handleGeneration } from '../commands/generate.command';

export const textMessageHandler = new Composer<MyContext>();

/**
 * Handle all text messages (non-commands)
 * Treat them as generation prompts
 */
textMessageHandler.on('message:text', async (ctx, next) => {
  const text = ctx.message.text;

  // Skip if it's a command
  if (text.startsWith('/')) {
    return next();
  }

  // Skip if it's a reply to bot's message (might be for conversation)
  if (ctx.message.reply_to_message) {
    return next();
  }

  // Treat as generation prompt
  await handleGeneration(ctx, text);
});
