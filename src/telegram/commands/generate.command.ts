import { Composer } from 'grammy';
import { MyContext } from '../telegram-context.interface';

export const generateCommand = new Composer<MyContext>();

generateCommand.command('generate', async (ctx) => {
  const prompt = ctx.match as string;

  if (!prompt || prompt.trim().length === 0) {
    return ctx.reply(
      `💡 Укажите описание изображения после команды.\n\n` +
        `Пример:\n` +
        `/generate Futuristic city at sunset\n\n` +
        `Или просто отправьте текстовое сообщение без команды.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💡 Примеры промптов', callback_data: 'examples' }],
          ],
        },
      },
    );
  }

  await handleGeneration(ctx, prompt.trim());
});

/**
 * Handle text-to-image generation
 */
export async function handleGeneration(ctx: MyContext, prompt: string) {
  try {
    // Get user
    const user = await ctx.userService.findByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.reply(
        '❌ Пользователь не найден. Используйте /start для регистрации.',
      );
    }

    // Calculate cost
    const cost = ctx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);

    // Check credits
    if (user.credits < cost) {
      return ctx.reply(
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
    }

    // Send processing message
    const statusMsg = await ctx.reply(
      `🎨 Генерирую изображение...\n⏱ Подождите 5-10 секунд\n\n` +
        `Промпт: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
    );

    try {
      // Generate image
      const generation = await ctx.generationService.generateTextToImage({
        userId: user.id,
        prompt,
      });

      // Delete status message
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

      // Send result
      const caption =
        `🎨 ${prompt}\n\n` +
        `💎 Использовано: ${cost} кредитов\n` +
        `💰 Осталось: ${user.credits - cost} кредитов\n` +
        `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

      // If we have fileId (Telegram storage) or URL (S3/R2)
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
        // Fallback: send as base64 (not recommended, large size)
        const buffer = Buffer.from(generation.imageData, 'base64');
        await ctx.replyWithPhoto(
          { source: buffer },
          {
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
          },
        );
      } else {
        await ctx.reply(
          `✅ Изображение сгенерировано, но произошла ошибка при отправке.\n` +
            `Generation ID: ${generation.id}`,
        );
      }
    } catch (error) {
      // Delete status message
      await ctx.api
        .deleteMessage(ctx.chat.id, statusMsg.message_id)
        .catch(() => {});

      console.error('Generation error:', error);

      await ctx.reply(
        `❌ Ошибка при генерации изображения\n\n` +
          `${error.message}\n\n` +
          `Попробуйте:\n` +
          `• Изменить промпт\n` +
          `• Попробовать позже\n` +
          `• Использовать /help для справки`,
      );
    }
  } catch (error) {
    console.error('Command error:', error);

    await ctx.reply(
      '❌ Произошла ошибка. Попробуйте позже или обратитесь в поддержку.',
    );
  }
}
