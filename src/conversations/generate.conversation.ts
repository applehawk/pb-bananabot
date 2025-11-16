import { Conversation } from '@grammyjs/conversations';
import { InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';

/**
 * GENERATE Conversation
 *
 * Handles text-to-image generation
 */
export async function generateConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // ВАЖНО: ctx.match не доступен в conversation из-за replay mechanism
  // Но ctx.message.text доступен, поэтому парсим команду вручную

  let prompt = '';

  // Пытаемся извлечь промпт из текста команды
  if (ctx.message?.text) {
    const text = ctx.message.text;
    // Убираем префикс команды /generate и пробелы
    prompt = text.replace(/^\/generate\s*/, '').trim();
    console.log('[GENERATE] Prompt from message text:', prompt);
  }

  // Если промпта нет, просим пользователя ввести
  if (!prompt || prompt.length === 0) {
    await ctx.reply(
      `💡 Укажите описание изображения.\n\n` +
        `Пример:\n` +
        `Futuristic city at sunset\n\n` +
        `Отправьте текстовое сообщение с описанием.`,
    );

    // Wait for user's text message
    const promptCtx = await conversation.waitFor('message:text');
    prompt = promptCtx.message?.text?.trim() || '';
    console.log('[GENERATE] Prompt from user input:', prompt);

    // Filter out commands from prompt
    if (prompt.startsWith('/')) {
      await ctx.reply('❌ Пожалуйста, отправьте описание без команды. Просто текст.');
      return;
    }

    if (!prompt || prompt.length === 0) {
      await ctx.reply('❌ Промпт не может быть пустым. Попробуйте снова: /generate');
      return;
    }
  }

  console.log('[GENERATE] Final prompt before generation:', prompt);

  // Get user and check credits using external
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
      .catch(() => {});

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
