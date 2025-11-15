import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { CommandEnum } from '../../enum/command.enum';

/**
 * SIXMONTH_TARIFF Conversation
 *
 * Sets 6-month tariff in session and navigates to payment.
 */
export async function sixMonthTariffConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // Set tariff in session
  ctx.session.tariffId = 'SIXMONTH_TARIFF';

  // Navigate to payment scene
  await conversation.external(() =>
    ctx.conversation.enter(CommandEnum.PAYMENT),
  );
}
