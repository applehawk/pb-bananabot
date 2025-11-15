import { Composer } from 'grammy';
import { MyContext } from '../telegram-context.interface';
import { TelegramFileDownloader } from '../utils/file-downloader.util';

export const photoHandler = new Composer<MyContext>();

const fileDownloader = new TelegramFileDownloader();

/**
 * Handle photo messages (Image-to-Image generation)
 */
photoHandler.on('message:photo', async (ctx) => {
  try {
    const user = await ctx.userService.findByTelegramId(ctx.from.id);

    if (!user) {
      return ctx.reply(
        '❌ Пользователь не найден. Используйте /start для регистрации.',
      );
    }

    // Get caption as prompt
    const prompt = ctx.message.caption || 'Улучши это изображение';

    // Calculate cost for image-to-image
    const cost = ctx.creditsService.calculateCost('IMAGE_TO_IMAGE', 1, 1);

    // Check credits
    if (user.credits < cost) {
      return ctx.reply(
        `💎 Недостаточно кредитов для Image-to-Image\n\n` +
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
      `🎨 Обрабатываю изображение...\n` +
        `⏱ Подождите 10-15 секунд\n\n` +
        `Промпт: "${prompt}"`,
    );

    try {
      // Download photo from Telegram
      const photoBuffer = await fileDownloader.downloadPhoto(
        ctx.api as any,
        ctx.message.photo,
      );

      // Generate with Gemini
      const generation = await ctx.generationService.generateImageToImage({
        userId: user.id,
        prompt,
        inputImages: [
          {
            buffer: photoBuffer,
            mimeType: 'image/jpeg',
          },
        ],
      });

      // Delete status message
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

      // Send result
      const caption =
        `🎨 Image-to-Image\n\n` +
        `Промпт: "${prompt}"\n\n` +
        `💎 Использовано: ${cost} кредитов\n` +
        `💰 Осталось: ${user.credits - cost} кредитов\n` +
        `⏱ Время: ${(generation.processingTime / 1000).toFixed(1)}с`;

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
                { text: '📜 История', callback_data: 'history' },
              ],
            ],
          },
        });
      } else if (generation.imageData) {
        const buffer = Buffer.from(generation.imageData, 'base64');
        await ctx.replyWithPhoto({ source: buffer }, { caption });
      }
    } catch (error) {
      await ctx.api
        .deleteMessage(ctx.chat.id, statusMsg.message_id)
        .catch(() => {});

      console.error('Image-to-Image error:', error);

      await ctx.reply(
        `❌ Ошибка при обработке изображения\n\n` +
          `${error.message}\n\n` +
          `Попробуйте другое изображение или другой промпт.`,
      );
    }
  } catch (error) {
    console.error('Photo handler error:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});
