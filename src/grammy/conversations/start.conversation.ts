import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';

/**
 * START Conversation
 *
 * Entry point for new users.
 * Shows app download links and then navigates to HOME.
 */
export async function startConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const scene = SCENES[CommandEnum.START];

  // Send initial message with download links
  const keyboard = new InlineKeyboard();
  for (const row of scene.buttons) {
    for (const button of row) {
      if (button.url) {
        keyboard.url(button.text, button.url);
      } else if (button.callback_data) {
        keyboard.text(button.text, button.callback_data);
      }
    }
    keyboard.row();
  }

  await ctx.reply(scene.text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });

  // Wait for callback query (button click)
  const response = await conversation.waitForCallbackQuery([
    CommandEnum.OUTLINE_APPLE,
    CommandEnum.OUTLINE_ANDROID,
    CommandEnum.OUTLINE_DOWNLOADED,
  ]);

  // Answer the callback query
  await response.answerCallbackQuery();

  // Navigate to HOME scene
  await conversation.external(() => ctx.conversation.enter(CommandEnum.HOME));
}