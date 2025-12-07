import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';

/**
 * BONUSES Conversation
 *
 * Shows referral link and bonuses
 */
export async function bonusesConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext,
) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
        await ctx.reply('❌ Не удалось определить пользователя.');
        return;
    }

    // Get bot username for ref link
    const botInfo = await conversation.external((ctx) => ctx.api.getMe());
    const botUsername = botInfo.username;

    // Generate Referral Link
    // Using telegram ID as the ref code
    const refLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

    // Fetch User Stats
    // We strictly return raw numbers to avoid serialization issues with Prisma objects
    const stats = await conversation.external(async (ctx) => {
        const userService = (ctx as any).userService;
        if (!userService) return { referralCount: 0, totalEarned: 0 };

        // We need the internal User ID (UUID) for getStatistics, not the Telegram ID
        const user = await userService.findByTelegramId(telegramId);
        if (!user) return { referralCount: 0, totalEarned: 0 };

        const fullStats = await userService.getStatistics(user.id);

        const referralCount = fullStats?.referrals || 0;
        const totalEarned = fullStats?.referralsList
            ? fullStats.referralsList.reduce((sum: number, ref: any) => sum + (ref.bonusAmount || 0), 0)
            : 0;

        return { referralCount, totalEarned };
    });

    let message = `🎁 <b>Бонусы и Реферальная программа</b>\n\n`;
    message += `Приглашайте друзей и получайте <b>50 рублей</b> за каждого приглашенного!\n`;
    message += `Ваша реферальная ссылка:\n`;
    message += `<code>${refLink}</code>\n\n`;

    message += `<b>📊 Ваша статистика:</b>\n`;

    // stats is now guaranteed to constitute raw data `{ referralCount, totalEarned }`
    message += `👥 Приглашено друзей: <b>${stats.referralCount}</b>\n`;
    message += `💰 Заработано: <b>${stats.totalEarned.toFixed(0)} руб.</b>\n`;

    message += `\n(Список последних приглашений будет доступен позже)`;

    await ctx.reply(message, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}
