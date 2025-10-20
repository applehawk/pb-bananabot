import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';
import { TariffService } from '../../tariff/tariff.service';
import { UserService } from '../../user/user.service';

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

  // Get services from context
  const tariffService: TariffService = (ctx as any).tariffService;
  const userService: UserService = (ctx as any).userService;

  // Get tariffs and user balance
  const tariffs = await tariffService.getAllTariffs();
  const user = await userService.findOneByUserId(userId);
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
  for (const row of buttonRows) {
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