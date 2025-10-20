import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { InlineKeyboard } from 'grammy';
import { SCENES } from '../constants/scenes.const';
import { CommandEnum } from '../../enum/command.enum';
import { OutlineService } from '../../outline/outline.service';
import { ConnectionService } from '../../prisma/connection.service';
import { UserService } from '../../user/user.service';
import { BotService } from '../../bot.service';

/**
 * CONNECT Conversation
 *
 * Creates VPN connection for user and displays connection links.
 * Redirects to GET_ACCESS if balance is insufficient.
 */
export async function connectConversation(conversation: Conversation<MyContext>, ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Get services from context (injected by middleware)
  const userService: UserService = (ctx as any).userService;
  const botService: BotService = (ctx as any).botService;
  const outlineService: OutlineService = (ctx as any).outlineService;
  const connService: ConnectionService = (ctx as any).connService;

  // Check balance
  const user = await userService.findOneByUserId(userId);
  if (user.balance <= botService.minimumBalance) {
    await conversation.external(() => ctx.conversation.enter(CommandEnum.GET_ACCESS));
    return;
  }

  // Create or get existing connection
  let connection;
  try {
    connection = await outlineService.createConnection(userId, 'OpenPNBot');
  } catch (error) {
    // If creation fails, get the most recent connection
    const connections = await connService.connections({ where: { userId } });
    connection = connections.reduce((acc, curr) => curr, null);
  }

  if (!connection) {
    await ctx.reply('❌ Не удалось создать подключение. Попробуйте позже.');
    return;
  }

  // Generate links
  const outlineLink = outlineService.getOutlineDynamicLink(connection);
  const fastRedirectLink = outlineService.getConnectionRedirectLink(connection);

  const sceneData = SCENES[CommandEnum.CONNECT].balancePositive(outlineLink);

  // Build keyboard with fast redirect links
  const keyboard = new InlineKeyboard()
    .url('для iOS 🍏', fastRedirectLink)
    .row()
    .url('для Android 🤖', fastRedirectLink);

  await ctx.reply(sceneData.text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}