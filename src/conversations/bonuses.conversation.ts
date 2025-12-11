import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { InlineKeyboard } from 'grammy';

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
    const refLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;

    // Fetch User Stats and Balance
    const data = await conversation.external(async (ctx) => {
        const userService = (ctx as any).userService;
        const defaultBonus = 50;

        if (!userService) return { referralCount: 0, totalEarned: 0, bonusAmount: defaultBonus, credits: 0 };

        let config = { freeCreditsAmount: 3, referralBonusAmount: 50, referralFirstPurchaseBonus: 150 };
        try {
            config = await userService.getSystemConfig();
        } catch (e) {
            console.error('Failed to fetch system config', e);
        }

        const user = await userService.findByTelegramId(telegramId);
        if (!user) return { referralCount: 0, totalEarned: 0, config, credits: 0 };

        const fullStats = await userService.getStatistics(user.id);

        const referralCount = fullStats?.referrals || 0;
        const totalEarned = fullStats?.referralsList
            ? fullStats.referralsList.reduce((sum: number, ref: any) => sum + (ref.bonusAmount || 0), 0)
            : 0;

        return { referralCount, totalEarned, config, credits: user.credits };
    });

    let message = `🎁 <b>Бонусы и Реферальная программа</b>\n\n`;
    message += `💳 Ваш текущий баланс: <b>${data.credits.toFixed(2)} монет</b>\n\n`;

    const { freeCreditsAmount, referralBonusAmount, referralFirstPurchaseBonus } = data.config;

    message += `Приглашайте друзей! `;
    if (freeCreditsAmount > 0) {
        message += `Каждый новый пользователь получит приветственный бонус <b>${freeCreditsAmount} монет бани</b>.\n`;
    } else {
        message += `\n`;
    }

    if (referralBonusAmount > 0) {
        message += `Вы, в свою очередь, получите <b>${referralBonusAmount} монет бани</b> за каждого приглашенного!\n`;
    }
    message += `\n`;

    if (referralFirstPurchaseBonus > 0) {
        message += `🚀 <b>Дополнительный бонус:</b>\nЗа первую покупку вашего друга вы получите еще <b>${referralFirstPurchaseBonus} монет бани</b>!\n\n`;
    }

    message += `Делитесь ссылкой с друзьями:\n(Нажми на ссылку чтобы скопировать)\n`;
    message += `<code>${refLink}</code>\n\n`;

    message += `<b>📊 Ваша статистика:</b>\n`;
    message += `👥 Приглашено друзей: <b>${data.referralCount}</b>\n`;
    message += `💰 Заработано: <b>${data.totalEarned.toFixed(0)} монет</b>\n`;
    message += `\n(Список последних приглашений будет доступен позже)`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}`;
    const keyboard = new InlineKeyboard()
        .text('💸 Отправить баланс другу', 'transfer_balance')
        .row()
        .url('💌 Поделиться ссылкой другу', shareUrl);

    await ctx.reply(message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard
    });
}

/**
 * Transfer Balance Conversation Flow
 */
export async function transferConversation(
    conversation: Conversation<MyContext>,
    ctx: MyContext
) {
    // Helper to exit flow (return to main)
    const cancel = async (msgId?: number) => {
        if (msgId) {
            await ctx.api.deleteMessage(ctx.chat!.id, msgId).catch(() => { });
        } else if (ctx.callbackQuery?.message) {
            await ctx.deleteMessage().catch(() => { });
        }
        await ctx.reply('❌ Перевод отменен. Возврат в главное меню.', { reply_markup: { remove_keyboard: true } });
        return;
    };

    // 1. Ask for Amount
    const balance = await conversation.external(c => c.userService.findByTelegramId(c.from!.id).then(u => u?.credits || 0));

    let amountStr = '';
    const amounts = [9, 19, 49, 99];

    // Construct keyboard
    const amountKeyboard = new InlineKeyboard();
    amounts.forEach(amt => amountKeyboard.text(`${amt} монет`, `amount:${amt}`));
    amountKeyboard.row();
    amountKeyboard.text('💰 Весь остаток', 'amount:all');
    amountKeyboard.text('✍️ Ввести свой', 'amount:custom').row();
    amountKeyboard.text('❌ Отменить', 'cancel');

    const promptMsg = await ctx.reply(
        `💸 <b>Перевод средств</b>\n\nВаш баланс: <b>${balance.toFixed(2)} монет</b>\nВыберите сумму для перевода:`,
        { reply_markup: amountKeyboard, parse_mode: 'HTML' }
    );

    let selectedAmount = 0;

    // Wait for amount selection
    while (true) {
        const input = await conversation.waitFor(['callback_query:data', 'message:text']);

        if (input.callbackQuery?.data === 'cancel') {
            await input.deleteMessage().catch(() => { });
            return;
        }

        if (input.callbackQuery?.data) {
            const data = input.callbackQuery.data;
            if (data.startsWith('amount:')) {
                const val = data.split(':')[1];
                if (val === 'all') {
                    if (balance <= 0) {
                        await input.answerCallbackQuery({ text: '❌ На балансе нет средств.', show_alert: true }).catch(() => { });
                        continue;
                    }
                    await input.answerCallbackQuery().catch(() => { });
                    selectedAmount = balance;
                    break;
                } else if (val === 'custom') {
                    await input.answerCallbackQuery().catch(() => { });
                    // Ask for custom amount
                    await input.editMessageText('✍️ <b>Введите сумму перевода</b> (целое число или дробное, например 49.5):', { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔙 Назад', 'back_amount').text('❌ Отменить', 'cancel') });

                    // Wait for custom input loop
                    let waitingCustom = true;
                    while (waitingCustom) {
                        const customInput = await conversation.waitFor(['message:text', 'callback_query:data']);
                        if (customInput.message) {
                            await customInput.deleteMessage().catch(() => { });
                        }

                        if (customInput.callbackQuery?.data === 'cancel') {
                            await customInput.deleteMessage().catch(() => { });
                            return;
                        }
                        if (customInput.callbackQuery?.data === 'back_amount') {
                            await customInput.answerCallbackQuery().catch(() => { });
                            // Go back to selection
                            await customInput.editMessageText(
                                `💸 <b>Перевод средств</b>\n\nВаш баланс: <b>${balance.toFixed(2)} монет</b>\nВыберите сумму для перевода:`,
                                { reply_markup: amountKeyboard, parse_mode: 'HTML' }
                            );
                            waitingCustom = false; // Break inner loop, continue outer (which will wait again)
                            break;
                        }

                        if (customInput.message?.text) {
                            let text = customInput.message.text.trim().replace(',', '.');
                            // Delete user input to keep chat clean

                            // Validate format: numbers only
                            if (!/^\d+(\.\d+)?$/.test(text)) {
                                await ctx.api.sendMessage(ctx.chat!.id, '❌ Неверный формат суммы. Пример: 49.5');
                                continue;
                            }
                            const val = parseFloat(text);
                            if (val <= 0) {
                                await ctx.api.sendMessage(ctx.chat!.id, '❌ Сумма должна быть больше 0 монет.');
                                continue;
                            }
                            if (val > balance) {
                                await ctx.api.sendMessage(ctx.chat!.id, `❌ Недостаточно средств. Ваш баланс: ${balance.toFixed(2)} монет`);
                                continue;
                            }

                            selectedAmount = val;
                            waitingCustom = false; // Got valid amount
                            // Do not break outer loop yet, we need to exit it too? 
                            // We can goto next step.
                        }
                    }
                    if (selectedAmount > 0) break; // Valid amount found
                } else {
                    selectedAmount = parseFloat(val);
                    if (selectedAmount > balance) {
                        await input.answerCallbackQuery({ text: '❌ Недостаточно средств!', show_alert: true }).catch(() => { });
                        continue;
                    }
                    await input.answerCallbackQuery().catch(() => { });
                    break; // Amount selected
                }
            } else if (data === 'back_amount') {
                // Should not happen here usually, but if re-rendering
            }
        }
    }

    // Step 2: Ask Recipient
    const recipientKeyboard = new InlineKeyboard()
        .text('🔙 Назад', 'back_to_amount')
        .text('❌ Отменить', 'cancel');

    // We already have promptMsg.
    // Update message to Step 2
    try {
        await ctx.api.editMessageText(
            ctx.chat!.id,
            promptMsg.message_id,
            `✅ Сумма: <b>${selectedAmount.toFixed(2)} монет</b>\n\n👤 <b>Кому перевести?</b>\nВведите @username, ID пользователя или перешлите сообщение от него.`,
            { reply_markup: recipientKeyboard, parse_mode: 'HTML' }
        );
    } catch (e) {
        // Fallback if message deleted
        await ctx.reply(
            `✅ Сумма: <b>${selectedAmount.toFixed(2)} монет</b>\n\n👤 <b>Кому перевести?</b>\nВведите @username, ID пользователя или перешлите сообщение от него.`,
            { reply_markup: recipientKeyboard, parse_mode: 'HTML' }
        );
    }

    let recipientUser: any = null;

    while (true) {
        const input = await conversation.waitFor(['message:text', 'message:forward_origin', 'callback_query:data']);

        if (input.message) {
            await input.deleteMessage().catch(() => { });
        }

        if (input.callbackQuery?.data === 'cancel') {
            await input.deleteMessage().catch(() => { });
            return;
        }
        if (input.callbackQuery?.data === 'back_to_amount') {
            await input.answerCallbackQuery().catch(() => { });
            // Need to restart conversion? Or jump back. 
            // Simplifying: just restart the function? Or loop.
            // Since we implemented amount selection above, handling back is tricky without statemachine.
            // Recursive call is easiest way to "go back".
            await input.deleteMessage().catch(() => { });
            return transferConversation(conversation, ctx);
        }

        let targetId: string | undefined;
        let targetUsername: string | undefined;

        if (input.message?.forward_origin) {
            // Handle forward
            const origin = input.message.forward_origin;
            if (origin.type === 'user') {
                targetId = String(origin.sender_user.id);
            } else if (origin.type === 'hidden_user') {
                await input.reply('❌ У этого пользователя скрытый аккаунт, невозможно определить ID.');
                continue;
            }
        } else if (input.message?.text) {
            const text = input.message.text.trim();
            if (text.startsWith('@')) {
                // By username
                targetUsername = text;
            } else if (/^\d+$/.test(text)) {
                // By ID
                targetId = text;
            } else {
                // Assume username without @? Or error.
                // Try as username
                targetUsername = text.startsWith('@') ? text : '@' + text;
            }
        }

        // Validate User
        recipientUser = await conversation.external(async (c) => {
            if (targetId) return c.userService.findByTelegramId(Number(targetId));
            if (targetUsername) return c.userService.findByUsername(targetUsername);
            return null;
        });

        if (!recipientUser) {
            await input.reply('❌ Пользователь не найден. Проверьте данные и попробуйте снова.');
            continue;
        }

        if (recipientUser.telegramId === BigInt(ctx.from!.id)) {
            await input.reply('❌ Нельзя переводить средства самому себе!');
            continue;
        }

        break; // User found
    }

    // Step 3: Confirmation
    const finalBalance = balance - selectedAmount;
    const confirmMsg =
        `💳 <b>Подтверждение перевода</b>\n\n` +
        `👤 Получатель: <b>${recipientUser.username ? '@' + recipientUser.username : recipientUser.firstName}</b> (ID: ${recipientUser.telegramId})\n` +
        `💰 Сумма: <b>${selectedAmount.toFixed(2)} монет</b>\n` +
        `💵 Ваш баланс сейчас: ${balance.toFixed(2)} монет\n` +
        `📉 Баланс после перевода: <b>${finalBalance.toFixed(2)} монет</b>\n\n` +
        `Подтвердить операцию?`;

    const confirmKeyboard = new InlineKeyboard()
        .text('✅ Перевести', 'confirm_transfer')
        .text('❌ Отменить', 'cancel'); // This cancel returns to main flow per request

    // If text message input was used, we edit the main message.
    try {
        await ctx.api.editMessageText(ctx.chat!.id, promptMsg.message_id, confirmMsg, { reply_markup: confirmKeyboard, parse_mode: 'HTML' });
    } catch (e) {
        await ctx.reply(confirmMsg, { reply_markup: confirmKeyboard, parse_mode: 'HTML' });
    }

    const confirmation = await conversation.waitForCallbackQuery(['confirm_transfer', 'cancel']);

    if (confirmation.callbackQuery.data === 'cancel') {
        await confirmation.deleteMessage().catch(() => { });
        return; // Exit to main flow
    }

    // Execute Transfer
    try {
        const senderDbId = await conversation.external(async (c) => {
            const u = await c.userService.findByTelegramId(c.from!.id);
            return u?.id;
        });

        if (!senderDbId) {
            await confirmation.reply('❌ Ошибка: отправитель не найден в базе.');
            return;
        }

        await conversation.external(c => c.userService.transferCredits(
            senderDbId,
            recipientUser.id,
            selectedAmount
        ));

        await confirmation.editMessageText(`✅ <b>Перевод успешно выполнен!</b>\nОтправлено ${selectedAmount.toFixed(2)} монет пользователю ${recipientUser.username || recipientUser.firstName}.`, { parse_mode: 'HTML', reply_markup: undefined });

        // Notify recipient if possible?
        try {
            await conversation.external(c => {
                const sender = c.from;
                const name = [sender?.first_name, sender?.last_name].filter(Boolean).join(' ');
                const username = sender?.username ? `@${sender.username}` : '';
                const senderLabel = [name, username].filter(Boolean).join(' ') || `ID: ${sender?.id}`;

                return c.api.sendMessage(Number(recipientUser.telegramId),
                    `💸 <b>Вам поступил перевод!</b>\n\nПолучено: <b>${selectedAmount.toFixed(2)} монет</b>\nОт: <b>${senderLabel}</b>`,
                    { parse_mode: 'HTML' }
                );
            });
        } catch (e) { /* ignore */ }

    } catch (e: any) {
        // await confirmation.reply(`❌ Ошибка при переводе: ${e.message}`);
        await ctx.api.editMessageText(ctx.chat!.id, promptMsg.message_id, `❌ <b>Ошибка при переводе</b>\n\n${e.message}\n\nПопробуйте позже.`, { parse_mode: 'HTML', reply_markup: undefined }).catch(() => { });
    }
}
