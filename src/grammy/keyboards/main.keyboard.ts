import { Keyboard } from 'grammy';

/**
 * Main Reply Keyboard
 *
 * Постоянная клавиатура с основными командами бота
 */
export function getMainKeyboard() {
  return new Keyboard()
    .text('💰 Баланс')
    .text('📜 История')
    .row()
    .text('❓ Помощь')
    .text('⚙️ Настройки')
    .resized()
    .persistent();
}

/**
 * Keyboard button text mappings to commands
 */
export const KeyboardCommands = {
  BALANCE: '💰 Баланс',
  HISTORY: '📜 История',
  HELP: '❓ Помощь',
  SETTINGS: '⚙️ Настройки',
} as const;
