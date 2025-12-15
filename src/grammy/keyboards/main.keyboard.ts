import { OverlayType } from '@prisma/client';
import { Keyboard } from 'grammy';

/**
 * Main Reply Keyboard
 *
 * Постоянная клавиатура с основными командами бота
 */
export function getMainKeyboard(activeOverlays: string[] = []) {
  const keyboard = new Keyboard();

  // Special Offer Button (Highest Priority)
  if (activeOverlays.includes(OverlayType.TRIPWIRE) || activeOverlays.includes(OverlayType.SPECIAL_OFFER)) {
    keyboard.text('⚡ Спецпредложение').row();
  }

  // Active Bonus Indicator
  const bonusText = activeOverlays.includes(OverlayType.BONUS) ? '🎁 Бонусы (🔥)' : '🎁 Бонусы';

  keyboard
    .text('💳 Пополнить')
    .text(bonusText)
    .row()
    .text('❓ Помощь')
    .text('⚙️ Настройки');

  return keyboard.resized().persistent();
}

/**
 * Keyboard button text mappings to commands
 */
export const KeyboardCommands = {
  BUY_CREDITS: '💳 Пополнить', // Was Balance
  BONUSES: '🎁 Бонусы', // Was History
  HELP: '❓ Помощь',
  SETTINGS: '⚙️ Настройки',
} as const;
