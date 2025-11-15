import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy-context.interface';
import { CommandEnum } from '../../enum/command.enum';

/**
 * MONTH_TARIFF Conversation
 *
 * Sets 30-day tariff in session and navigates to payment.
 */
export async function monthTariffConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // Set tariff in session
  ctx.session.tariffId = 'MONTH_TARIFF';

  // Navigate to payment scene
  await conversation.external(() =>
    ctx.conversation.enter(CommandEnum.PAYMENT),
  );
}
