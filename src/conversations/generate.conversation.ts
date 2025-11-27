import { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard, InputFile } from 'grammy';
import { MyContext } from '../grammy/grammy-context.interface';
import { KeyboardCommands } from '../grammy/keyboards/main.keyboard';
import { CommandEnum } from '../enum/command.enum';
import axios from 'axios';

type GenerationMode = 'text' | 'image';

/**
 * GENERATE Conversation
 *
 * Handles text-to-image and image-to-image generation
 */
export async function generateConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // ВАЖНО: ctx.match не доступен в conversation из-за replay mechanism
  // Но ctx.message.text доступен, поэтому парсим команду вручную

  let prompt = '';
  let mode: GenerationMode = 'text';
  let inputImageFileId: string | null = null;
  let isSelectingMode = false;

  // Пытаемся извлечь промпт из текста команды
  if (ctx.message?.text) {
    const text = ctx.message.text;
    // Убираем префикс команды /generate и пробелы
    const extractedPrompt = text.replace(/^\/generate\s*/, '').trim();

    // Игнорируем текст, если это название кнопки или команды
    const ignoredTexts = [
      KeyboardCommands.GENERATE,
      `/${CommandEnum.GENERATE}`,
    ];
    if (extractedPrompt && !ignoredTexts.includes(extractedPrompt)) {
      prompt = extractedPrompt;
    }
  }

  // Interactive Prompt UI
  // Determine user credits to conditionally show "Buy credits" button
  let user: any = null;
  let cost = 0;

  const refreshUser = async () => {
    await conversation.external(async (ctx) => {
      const telegramId = ctx.from?.id;
      if (telegramId) {
        user = await ctx.userService.findByTelegramId(telegramId);
        if (user) {
          // Calculate cost based on mode
          if (mode === 'text') {
            cost = ctx.creditsService.calculateCost('TEXT_TO_IMAGE', 0, 1);
          } else {
            // Image-to-Image cost (assuming 1 input image)
            cost = ctx.creditsService.calculateCost('IMAGE_TO_IMAGE', 1, 1);
          }
        }
      }
    });
  };

  await refreshUser();

  // Local state for aspect ratio
  let currentRatio = user?.settings?.aspectRatio || '1:1';

  // Helper to build UI
  const buildUI = () => {
    const canGenerate = user && user.credits >= cost;
    const keyboard = new InlineKeyboard();

    if (isSelectingMode) {
      keyboard.text(mode === 'text' ? '✅ Текст' : 'Текст', 'mode_text');
      keyboard.text(mode === 'image' ? '✅ Изображение+Текст' : 'Изображение+Текст', 'mode_image');
      keyboard.row();
      keyboard.text('🔙 Назад', 'mode_back');

      return {
        text: '⚙️ <b>Выберите режим генерации:</b>\n\n' +
          '<b>Текст:</b> Генерация изображения по текстовому описанию.\n' +
          '<b>Изображение+Текст:</b> Генерация на основе вашего изображения и текста.',
        keyboard
      };
    }

    // Main UI
    let messageText = '';

    if (mode === 'text') {
      if (prompt) {
        messageText = `ваш запрос: <b>${prompt}</b>`;
      } else {
        messageText = `✍️ Напиши описание для генерации картинки и отправь его!`;
      }
    } else {
      if (inputImageFileId) {
        messageText += `✅ Изображение загружено\n`;
      } else {
        messageText += `📥 <b>Отправьте изображение</b> для обработки.\n`;
      }

      if (prompt) {
        messageText += `📝 Ваш запрос: <b>${prompt}</b>\n`;
      } else {
        messageText += `✍️ <b>Напиши описание</b> изменений или стиля.\n`;
      }
    }

    // Buttons
    const readyToGenerate = mode === 'text' ? !!prompt : (!!prompt && !!inputImageFileId);

    if (readyToGenerate) {
      if (canGenerate) {
        // Aspect Ratio Buttons
        const ratios = ['1:1', '16:9', '9:16', '3:4', '4:3'];
        ratios.forEach((r, i) => {
          const label = r === currentRatio ? `✅ ${r}` : r;
          keyboard.text(label, `aspect_${r}`);
          if ((i + 1) % 3 === 0) keyboard.row();
        });
        if (ratios.length % 3 !== 0) keyboard.row();

        keyboard.text('🎨 Сгенерировать!', 'generate_trigger').row();

      } else {
        keyboard.text('💳 Купить кредиты', 'buy_credits').row();
      }
    }

    // Mode switch button
    keyboard.row();
    keyboard.text('⚙️ Режим', 'set_mode');

    // Add credit warning to text if needed
    if (readyToGenerate) {
      if (!canGenerate) {
        messageText += `\n\n⚠️ <b>Недостаточно кредитов!</b>\nДля генерации требуется ${cost} кредитов.`;
      } else {
        messageText += `\n\nНажмите кнопку ниже, чтобы начать.`;
      }
    }

    return { text: messageText, keyboard };
  };

  const initialUI = buildUI();
  const msg = await ctx.reply(initialUI.text, { reply_markup: initialUI.keyboard, parse_mode: 'HTML' });

  while (true) {
    const ctx2 = await conversation.waitFor(['message:text', 'message:photo', 'callback_query:data']);

    // Handle text input
    if (ctx2.message?.text) {
      const incomingText = ctx2.message.text;

      // Check if user pressed any main keyboard button - if so, exit conversation
      const keyboardButtonValues = Object.values(KeyboardCommands);
      if (keyboardButtonValues.includes(incomingText as any)) {
        // User pressed a main keyboard button - exit conversation
        await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => { });
        return; // Exit conversation, let global handlers process the button
      }

      prompt = incomingText;
      await ctx2.deleteMessage().catch(() => { });
      await refreshUser(); // Refresh cost/credits

      const ui = buildUI();
      await ctx.api.editMessageText(
        ctx.chat.id,
        msg.message_id,
        ui.text,
        { reply_markup: ui.keyboard, parse_mode: 'HTML' },
      ).catch(() => { });
      continue;
    }

    // Handle photo input
    if (ctx2.message?.photo) {
      if (mode === 'image') {
        // Get the largest photo
        const photo = ctx2.message.photo[ctx2.message.photo.length - 1];
        inputImageFileId = photo.file_id;

        // Also check for caption if prompt is empty
        if (ctx2.message.caption && !prompt) {
          prompt = ctx2.message.caption;
        }

        await ctx2.deleteMessage().catch(() => { });
        await refreshUser();

        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });
      } else {
        // If in text mode, just delete to keep chat clean
        await ctx2.deleteMessage().catch(() => { });
      }
      continue;
    }

    // Handle callbacks
    if (ctx2.callbackQuery?.data) {
      const data = ctx2.callbackQuery.data;

      if (data === 'set_mode') {
        isSelectingMode = true;
        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });
        await ctx2.answerCallbackQuery();
        continue;
      }

      if (data === 'mode_text') {
        mode = 'text';
        isSelectingMode = false;
        await refreshUser();
        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });
        await ctx2.answerCallbackQuery();
        continue;
      }

      if (data === 'mode_image') {
        mode = 'image';
        isSelectingMode = false;
        await refreshUser();
        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });
        await ctx2.answerCallbackQuery();
        continue;
      }

      if (data === 'mode_back') {
        isSelectingMode = false;
        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });
        await ctx2.answerCallbackQuery();
        continue;
      }

      if (data.startsWith('aspect_')) {
        const selected = data.split('_')[1];
        currentRatio = selected;

        if (user) {
          user.settings = { ...(user.settings || {}), aspectRatio: selected };
          await conversation.external(async (ctx) => {
            await ctx.userService.updateSettings(user.id, { aspectRatio: selected });
          });
        }

        await refreshUser();
        const ui = buildUI();
        await ctx.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          ui.text,
          { reply_markup: ui.keyboard, parse_mode: 'HTML' },
        ).catch(() => { });

        await ctx2.answerCallbackQuery();
        continue;
      }

      if (data === 'generate_trigger') {
        if (!prompt) {
          await ctx2.answerCallbackQuery({ text: '❌ Сначала введите описание!' });
          continue;
        }

        if (mode === 'image' && !inputImageFileId) {
          await ctx2.answerCallbackQuery({ text: '❌ Сначала загрузите изображение!' });
          continue;
        }

        await refreshUser();
        if (!user || user.credits < cost) {
          await ctx2.answerCallbackQuery({ text: '❌ Недостаточно кредитов!', show_alert: true });
          const ui = buildUI();
          await ctx.api.editMessageText(
            ctx.chat.id,
            msg.message_id,
            ui.text,
            { reply_markup: ui.keyboard, parse_mode: 'HTML' },
          ).catch(() => { });
          continue;
        }

        await ctx2.answerCallbackQuery();
        await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => { });
        break; // Proceed to generation
      }

      if (data === 'buy_credits') {
        await ctx2.answerCallbackQuery();
        ctx.session.quickBuy = true;
        await ctx.conversation.enter('buy_credits');
        return;
      }
    }
  }

  console.log('[GENERATE] Final prompt before generation:', prompt);

  const telegramId = ctx.from?.id;
  if (!telegramId) {
    await ctx.reply('❌ Не удалось определить пользователя.');
    return;
  }

  await refreshUser();

  if (!user) {
    await ctx.reply(
      '❌ Пользователь не найден. Используйте /start для регистрации.',
    );
    return;
  }

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

  const statusMsg = await ctx.reply(
    `🎨 Генерирую изображение...\n⏱ Подождите 5-10 секунд\n\n` +
    `Промпт: "${prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt}"`,
  );

  try {
    let generation: any = null;

    if (mode === 'text') {
      await conversation.external(async (ctx) => {
        generation = await ctx.generationService.generateTextToImage({
          userId: user.id,
          prompt,
          aspectRatio: currentRatio,
        });
      });
    } else {
      // Image to Image
      // 1. Get file URL
      const file = await ctx.api.getFile(inputImageFileId!);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      // 2. Download file buffer
      let imageBuffer: Buffer;
      await conversation.external(async () => {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
      });

      // 3. Generate
      await conversation.external(async (ctx) => {
        generation = await ctx.generationService.generateImageToImage({
          userId: user.id,
          prompt,
          inputImages: [{ buffer: imageBuffer, mimeType: 'image/jpeg' }], // Assuming JPEG from Telegram usually
          aspectRatio: currentRatio,
        });
      });
    }

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

    const caption =
      `🎨 ${prompt}\n\n` +
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
              { text: '⚙️ Параметры', callback_data: 'settings' },
            ],
            [{ text: '📜 История', callback_data: 'history' }],
          ],
        },
      });
    } else if (generation.imageData) {
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
