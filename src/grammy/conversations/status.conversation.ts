import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';

/**
 * STATUS Conversation
 *
 * Displays user's current status: username and balance.
 */
export async function statusConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'не указан';

  if (!userId) return;

  // Get user data using conversation.external() to prevent re-execution during replay
  // Pass ctx as parameter to access the outside context with middleware-injected services
  const user = await conversation.external((ctx) => ctx.userService.findOneByUserId(userId));
  const balance = user.balance.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });

  // Get scene config
  const scene = SCENES[CommandEnum.STATUS];
  const text = scene.text(username, balance, 0);

  // Build keyboard
  const keyboard = new InlineKeyboard();
  for (const row of scene.buttons) {
    for (const button of row) {
      if (button.callback_data) {
        keyboard.text(button.text, button.callback_data);
      }
    }
    keyboard.row();
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}