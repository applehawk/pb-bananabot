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
  // Old welcome message (saved for future use)
  /*
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
  */

  const welcomeMessage =
    `🤖 Добро пожаловать в AI-ИЛЛЮСТРАТОР!\n\n` +
    `🎨 Что я умею:\n` +
    `• Текст → Изображение: Напишите описание → получите изображение\n` +
    `• Фото → Новое изображение: Отправьте фото с подписью → получите новое изображение в том же стиле\n` +
    `• Альбом → Новое изображение: Отправьте несколько фото с подписью → получите изображение на основе референсов\n\n` +
    `📋 Как использовать:\n` +
    `1. Просто текст: Напишите "красивый закат" → получите изображение заката\n` +
    `2. Одно фото: Отправьте фото кота с подписью "кот в космосе" → получите кота в космосе в стиле вашего фото\n` +
    `3. Альбом фото: Отправьте несколько фото с подписью "пейзаж в стиле импрессионизма" → получите пейзаж\n` +
    `4. Фото + текст: Отправьте фото с промптом → получите новую сцену с теми же людьми\n\n` +
    `💡 Примеры промптов:\n` +
    `• "красивая девушка в платье на пляже"\n` +
    `• "мужчина в костюме в офисе"\n` +
    `• "два человека танцуют на вечеринке"\n\n` +
    `🎯 Особенность: Бот анализирует людей на ваших фотографиях и создает новые изображения с теми же людьми в новых сценариях!\n\n` +
    `⚡ Начните прямо сейчас - отправьте фото с промптом!`;

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: getMainKeyboard(),
  });

  // Wait for first message from user (text, photo, album or callback)
  const firstMessage = await conversation.wait() as MyContext;

  // Check if it's a callback query (button press)
  if (firstMessage.callbackQuery) {
    console.log('[START] User pressed button, exiting conversation');
    return;
  }

  const text = firstMessage.message?.text?.trim();
  const caption = firstMessage.message?.caption?.trim();
  const prompt = text || caption || '';

  console.log('[START] Received first message:', {
    text,
    caption,
    hasPhoto: !!firstMessage.message?.photo,
    hasMediaGroup: !!firstMessage.message?.media_group_id
  });

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
      // So we MUST handle it here.
      // Let's just send the welcome message again by recursing.
      await startConversation(conversation, firstMessage);
    }

    return;
  }

  // If we have content (text, photo, or album), proceed to generation
  if (prompt || firstMessage.message?.photo || firstMessage.message?.media_group_id) {
    console.log('[START] Starting generation with content');
    await generateConversation(conversation, firstMessage);
    return;
  }

  // If empty and no content, warn
  if (!prompt || prompt.length === 0) {
    await ctx.reply(
      '💡 Используйте кнопки меню или команды для работы с ботом!',
    );
    return;
  }
}
