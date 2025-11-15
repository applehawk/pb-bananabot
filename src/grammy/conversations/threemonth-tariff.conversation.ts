import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { CommandEnum } from '../../enum/command.enum';

/**
 * THREEMONTH_TARIFF Conversation
 *
 * Sets 3-month tariff in session and navigates to payment.
 */
export async function threeMonthTariffConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // Set tariff in session
  ctx.session.tariffId = 'THREEMONTH_TARIFF';

  // Navigate to payment scene
  await conversation.external(() =>
    ctx.conversation.enter(CommandEnum.PAYMENT),
  );
}
