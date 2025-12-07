import { Keyboard } from 'grammy';

/**
 * Main Reply Keyboard
 *
 * Постоянная клавиатура с основными командами бота
 */
export function getMainKeyboard() {
  return new Keyboard()
    .text('💳 Пополнить')
    .text('🎁 Бонусы')
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
  BALANCE: '💳 Пополнить', // Was Balance
  HISTORY: '🎁 Бонусы', // Was History
  HELP: '❓ Помощь',
  SETTINGS: '⚙️ Настройки',
} as const;
