import { Conversation } from '@grammyjs/conversations';
import { MyContext } from '../grammy/grammy-context.interface';

/**
 * HELP Conversation
 *
 * Displays help information, commands, and usage examples
 */
export async function helpConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  const helpMessage =
    `🤖 **AI Image Generator Bot - Справка**\n\n` +
    `**Основные команды:**\n` +
    `/start - Начать работу с ботом\n` +
    `/generate [описание] - Сгенерировать изображение\n` +
    `/balance - Проверить баланс\n` +
    `/buy - Купить кредиты\n` +
    `/history - История генераций\n` +
    `/settings - Настройки генерации\n` +
    `/help - Эта справка\n\n` +
    `**Как использовать:**\n\n` +
    `1️⃣ **Text-to-Image**\n` +
    `Просто отправьте текстовое описание или используйте /generate:\n` +
    `\`Футуристический город на закате\`\n` +
    `\`/generate Cosmic landscape with nebula\`\n\n` +
    `2️⃣ **Image-to-Image**\n` +
    `Отправьте фото с подписью:\n` +
    `[Фото] + "Сделай в стиле аниме"\n\n` +
    `3️⃣ **Multi-Image**\n` +
    `Отправьте несколько фото (альбом) с описанием\n\n` +
    `**Стоимость:**\n` +
    `💎 Text-to-Image: 1 кредит\n` +
    `💎 Image-to-Image: 1.5 кредита\n` +
    `💎 Multi-Image (2-4): 2 кредита\n` +
    `💎 Multi-Image (5-16): 3 кредита\n\n` +
    `**Примеры промптов:**\n` +
    `✨ "Magical forest with glowing mushrooms"\n` +
    `🌆 "Cyberpunk street at night, neon lights"\n` +
    `🎨 "Oil painting of mountain landscape"\n` +
    `👾 "Cute robot character, 3D render"\n` +
    `🌌 "Galaxy with colorful nebula"\n\n` +
    `**Советы:**\n` +
    `• Будьте конкретны в описании\n` +
    `• Указывайте стиль (аниме, реализм, 3D)\n` +
    `• Упоминайте освещение и настроение\n` +
    `• Используйте английский язык для лучших результатов\n\n` +
    `Есть вопросы? Пишите в поддержку!`;

  await ctx.reply(helpMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎨 Генерировать', switch_inline_query_current_chat: '' }],
        [
          { text: '💡 Примеры', callback_data: 'examples' },
          { text: '⚙️ Настройки', callback_data: 'settings' },
        ],
      ],
    },
  });
}
