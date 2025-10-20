import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { Keyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';

/**
 * HOME Conversation
 *
 * Main menu with navigation buttons.
 * Displays available actions: Status, Connect, Get Access, Question.
 */
export async function homeConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const scene = SCENES[CommandEnum.HOME];

  // Build reply keyboard
  const keyboard = new Keyboard();
  for (const row of scene.navigateButtons) {
    for (const button of row) {
      keyboard.text(button.text);
    }
    keyboard.row();
  }

  await ctx.reply(scene.navigateText, {
    parse_mode: 'HTML',
    reply_markup: keyboard.resized(),
  });
}