import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';
import { getMainKeyboard, KeyboardCommands } from '../grammy/keyboards/main.keyboard';
import { CommandEnum } from '../enum/command.enum';
import { generateConversation } from './generate.conversation';
import { balanceConversation } from './balance.conversation';
import { historyConversation } from './history.conversation';
import { helpConversation } from './help.conversation';
import { buyCreditsConversation } from './buy-credits.conversation';

/**
 * START Conversation
 *
 * Welcome conversation for new and returning users
 */
export async function startConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // Get user credits using external (Golden Rule: external operations must be wrapped)
  let credits = 0;
  if (ctx.from?.id) {
    const telegramId = ctx.from.id;

    await conversation.external(async (ctx) => {
      const user = await ctx.userService.findByTelegramId(telegramId);
      credits = user?.credits || 0;
    });
  }

  // Welcome message
  const welcomeMessage =
    `🎨 **AI Image Generator Bot**\n\n` +
    `Привет! Я помогу тебе создавать изображения с помощью ИИ.\n\n` +
    `**Что я умею:**\n` +
    `🖼 Генерация изображений по текстовому описанию\n` +
    `🎭 Стилизация фотографий\n` +
    `✨ Создание вариаций изображений\n\n` +
    `**Быстрый старт:**\n` +
    `💡 Отправь мне описание изображения прямо сейчас, и я его создам!\n\n` +
    `**Или используй кнопки:**\n` +
    `• 🎨 Генерация - создать изображение\n` +
    `• 💰 Баланс - проверить кредиты\n` +
    `• 📜 История - посмотреть прошлые генерации\n\n` +
    `💎 Баланс: **${credits}** кредитов`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(),
  });

  // Wait for first message from user (text or callback)
  const firstMessage = await conversation.wait() as MyContext;

  // Check if it's a callback query (button press)
  if (firstMessage.callbackQuery) {
    console.log('[START] User pressed button, exiting conversation');
    return;
  }

  const prompt = firstMessage.message?.text?.trim() || '';

  console.log('[START] Received first message:', prompt);

  // If user sent a command or button text, exit (they're using the menu)
  // Handle menu buttons and commands
  if (prompt === KeyboardCommands.GENERATE) {
    await generateConversation(conversation, firstMessage);
    return;
  }
  if (prompt === KeyboardCommands.BALANCE) {
    await balanceConversation(conversation, firstMessage);
    return;
  }
  if (prompt === KeyboardCommands.HISTORY) {
    await historyConversation(conversation, firstMessage);
    return;
  }
  if (prompt === KeyboardCommands.HELP) {
    await helpConversation(conversation, firstMessage);
    return;
  }
  if (prompt === '💎 Купить кредиты') {
    await buyCreditsConversation(conversation, firstMessage);
    return;
  }

  if (prompt.startsWith('/')) {
    console.log('[START] User used command, exiting conversation');

    if (prompt === '/balance') await balanceConversation(conversation, firstMessage);
    else if (prompt === '/generate') await generateConversation(conversation, firstMessage);
    else if (prompt === '/history') await historyConversation(conversation, firstMessage);
    else if (prompt === '/help') await helpConversation(conversation, firstMessage);
    else if (prompt === '/buy' || prompt === '/buy_credits') await buyCreditsConversation(conversation, firstMessage);
    else if (prompt === '/start') {
      // For /start, we can just restart the current conversation or return to let the global handler pick it up?
      // If we return, the conversation ends. The global handler for /start will run.
      // But we are processing the message NOW.
      // If we return, the message is consumed.
      // So we should probably just recurse or do nothing (since we are in start).
      // But startConversation shows the welcome message at the beginning.
      // So calling startConversation(conversation, firstMessage) would show it again.
      // But startConversation is THIS function. Recursion?
      // Yes, we can recurse.
      // await startConversation(conversation, firstMessage);
      // But we need to be careful about infinite loops if not handled.
      // Actually, simpler to just return and let the user trigger it again? 
      // No, if we return, the current message processing is done.
      // The user sent /start. We return. Conversation ends.
      // The global handler for /start is NOT triggered because the conversation consumed the update.
      // So we MUST handle it here.
      // Let's just send the welcome message again by recursing.
      // But I need to export startConversation to call it? It is exported.
      // But I am inside it.
      // I can just call startConversation(conversation, firstMessage).
      // However, TS might complain about circular reference if I import it?
      // I don't need to import it, it's in the scope.
      // But wait, the function is defined as export async function...
      // I can call it recursively.
      await startConversation(conversation, firstMessage);
    }

    return;
  }

  // If prompt is empty, exit
  if (!prompt || prompt.length === 0) {
    await ctx.reply(
      '💡 Используйте кнопки меню или команды для работы с ботом!',
    );
    return;
  }

  console.log('[START] Starting generation with prompt:', prompt);

  // Get user and check credits
  let user: any = null;
  let cost = 0;
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  await conversation.external(async (ctx) => {
    user = await ctx.userService.findByTelegramId(telegramId);
    if (user) {
      cost = ctx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
    }
  });

  if (!user) {
    await ctx.reply(
      '❌ Пользователь не найден. Используйте /start для регистрации.',
    );
    return;
  }

  // Check credits
  if (user.credits < cost) {
    await ctx.reply(
      `💎 Недостаточно кредитов\n\n` +
      `Требуется: ${cost}\n` +
      `Доступно: ${user.credits}\n\n` +
      `Пополните баланс: /buy`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Купить кредиты', callback_data: 'buy_credits' }],
          ],
        },
      },
    );
    return;
  }

  // Send processing message
  const statusMsg = await ctx.reply(
    `🎨 Генерирую изображение...\n⏱ Подождите 5-10 секунд\n\n` +
    `Промпт: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
  );

  try {
    // Generate image using external
    let generation: any = null;

    await conversation.external(async (ctx) => {
      generation = await ctx.generationService.generateTextToImage({
        userId: user.id,
        prompt,
      });
    });

    // Delete status message
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Send result
    const caption =
      `🎨 ${prompt}\n\n` +
      `💎 Использовано: ${cost} кредитов\n` +
      `💰 Осталось: ${user.credits - cost} кредитов\n` +
      `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

    // Use fileId or URL
    const imageSource = generation.fileId || generation.imageUrl;

    if (imageSource) {
      await ctx.replyWithPhoto(imageSource, {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Вариация',
                callback_data: `regenerate_${generation.id}`,
              },
              { text: '⚙️ Параметры', callback_data: 'settings' },
            ],
            [{ text: '📜 История', callback_data: 'history' }],
          ],
        },
      });
    } else if (generation.imageData) {
      // Fallback to base64
      const { InputFile } = await import('grammy');
      const buffer = Buffer.from(generation.imageData, 'base64');
      await ctx.replyWithPhoto(new InputFile(buffer), {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Вариация',
                callback_data: `regenerate_${generation.id}`,
              },
            ],
          ],
        },
      });
    } else {
      await ctx.reply(
        `✅ Изображение сгенерировано, но произошла ошибка при отправке.\n` +
        `Generation ID: ${generation.id}`,
      );
    }
  } catch (error) {
    await ctx.api
      .deleteMessage(ctx.chat.id, statusMsg.message_id)
      .catch(() => { });

    await ctx.reply(
      `❌ Ошибка при генерации изображения\n\n` +
      `${error.message}\n\n` +
      `Попробуйте:\n` +
      `• Изменить промпт\n` +
      `• Попробовать позже\n` +
      `• Использовать /help для справки`,
    );
  }
}
