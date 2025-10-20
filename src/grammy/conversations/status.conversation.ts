import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';
import { UserService } from '../../user/user.service';
import { ConnectionService } from '../../prisma/connection.service';

/**
 * STATUS Conversation
 *
 * Displays user's current status: username, balance, and number of connections.
 */
export async function statusConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'не указан';

  if (!userId) return;

  // Get services from context
  const userService: UserService = (ctx as any).userService;
  const connService: ConnectionService = (ctx as any).connService;

  // Get user data
  const user = await userService.findOneByUserId(userId);
  const balance = user.balance.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  });

  // Count connections
  const connections = await connService.connections({ where: { userId } });
  const connectionsNumber = connections.length;

  // Get scene config
  const scene = SCENES[CommandEnum.STATUS];
  const text = scene.text(username, balance, connectionsNumber);

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