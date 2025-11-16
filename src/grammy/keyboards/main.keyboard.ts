import { Keyboard } from 'grammy';

/**
 * Main Reply Keyboard
 *
 * Постоянная клавиатура с основными командами бота
 */
export function getMainKeyboard() {
  return new Keyboard()
    .text('🎨 Генерация')
    .text('💰 Баланс')
    .row()
    .text('📜 История')
    .text('❓ Помощь')
    .resized()
    .persistent();
}

/**
 * Keyboard button text mappings to commands
 */
export const KeyboardCommands = {
  GENERATE: '🎨 Генерация',
  BALANCE: '💰 Баланс',
  HISTORY: '📜 История',
  HELP: '❓ Помощь',
} as const;
