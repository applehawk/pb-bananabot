import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';

/**
 * QUESTION Conversation
 *
 * Help/support scene with link to community chat.
 */
export async function questionConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const scene = SCENES[CommandEnum.QUESTION];

  // Build keyboard
  const keyboard = new InlineKeyboard();
  for (const row of scene.buttons) {
    for (const button of row) {
      if ('url' in button && button.url) {
        keyboard.url(button.text, button.url as string);
      } else if ('callback_data' in button && button.callback_data) {
        keyboard.text(button.text, button.callback_data as string);
      }
    }
    keyboard.row();
  }

  await ctx.reply(scene.text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
