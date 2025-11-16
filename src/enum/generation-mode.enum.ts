/**
 * Generation Mode Enum
 *
 * Определяет режимы генерации изображений
 */
export enum GenerationMode {
  TEXT_TO_IMAGE = 'TEXT_TO_IMAGE', // Обычная генерация по тексту
  IMAGE_TO_IMAGE = 'IMAGE_TO_IMAGE', // Стилизация загруженного изображения
  MULTI_IMAGE = 'MULTI_IMAGE', // Генерация нескольких вариантов (2-16)
}

/**
 * Получить название режима на русском
 */
export function getGenerationModeName(mode: GenerationMode): string {
  const names: Record<GenerationMode, string> = {
    [GenerationMode.TEXT_TO_IMAGE]: 'Текст → Изображение',
    [GenerationMode.IMAGE_TO_IMAGE]: 'Стилизация изображения',
    [GenerationMode.MULTI_IMAGE]: 'Множественная генерация',
  };
  return names[mode];
}

/**
 * Получить описание режима
 */
export function getGenerationModeDescription(mode: GenerationMode): string {
  const descriptions: Record<GenerationMode, string> = {
    [GenerationMode.TEXT_TO_IMAGE]:
      'Создание изображения по текстовому описанию',
    [GenerationMode.IMAGE_TO_IMAGE]:
      'Стилизация загруженного изображения по промпту',
    [GenerationMode.MULTI_IMAGE]:
      'Генерация 2-16 вариантов одного промпта',
  };
  return descriptions[mode];
}

/**
 * Получить эмодзи для режима
 */
export function getGenerationModeEmoji(mode: GenerationMode): string {
  const emojis: Record<GenerationMode, string> = {
    [GenerationMode.TEXT_TO_IMAGE]: '🎨',
    [GenerationMode.IMAGE_TO_IMAGE]: '🖼',
    [GenerationMode.MULTI_IMAGE]: '🎭',
  };
  return emojis[mode];
}
