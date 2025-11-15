import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';

/**
 * GET_ACCESS Conversation
 *
 * Displays available tariff plans with pricing.
 * User selects a tariff to proceed to payment.
 */
export async function getAccessConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Get tariffs and user balance using conversation.external() to prevent re-execution during replay
  // Pass ctx as parameter to access the outside context with middleware-injected services
  const tariffs = await conversation.external((ctx) => ctx.tariffService.getAllTariffs());
  const user = await conversation.external((ctx) => ctx.userService.findOneByUserId(userId));
  const currentBalance = user.balance.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });

  const scene = SCENES[CommandEnum.GET_ACCESS];

  // Generate text with tariffs
  const text = scene.text(tariffs, currentBalance);

  // Generate buttons from tariffs
  const buttonRows = scene.buttons(tariffs);

  // Build keyboard
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < buttonRows.length; i++) {
    const row = buttonRows[i];
    for (const button of row) {
      if (button.callback_data) {
        keyboard.text(button.text, button.callback_data);
      }
    }
    // Only add a new row if this is not the last row
    if (i < buttonRows.length - 1) {
      keyboard.row();
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}