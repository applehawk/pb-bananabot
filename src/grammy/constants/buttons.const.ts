import { CommandEnum } from '../../enum/command.enum';
import { InlineKeyboard } from 'grammy';

/**
 * Button definitions for grammY
 *
 * Migrated from Telegraf's Markup.button format to grammY format.
 * Each button stores text and either callback_data or url.
 */
export const BUTTONS = {
  [CommandEnum.BACK]: { text: '⬅ назад', callback_data: CommandEnum.BACK },
  [CommandEnum.HOME]: { text: '📱в меню', callback_data: CommandEnum.HOME },

  [CommandEnum.STATUS]: { text: 'ℹ️ Статус', callback_data: CommandEnum.STATUS },
  [CommandEnum.PAYMENT]: { text: 'Купить', callback_data: CommandEnum.PAYMENT },
  [CommandEnum.QUESTION]: { text: '❓ Помощь', callback_data: CommandEnum.QUESTION },

  [CommandEnum.MONTH_TARIFF]: { text: '30 дней', callback_data: CommandEnum.MONTH_TARIFF },
  [CommandEnum.THREEMONTH_TARIFF]: {
    text: '🔥 3 месяца',
    callback_data: CommandEnum.THREEMONTH_TARIFF,
  },
  [CommandEnum.SIXMONTH_TARIFF]: {
    text: '🚀 6 месяцев',
    callback_data: CommandEnum.SIXMONTH_TARIFF,
  },

  [CommandEnum.GET_ACCESS]: { text: '🔥 Купить', callback_data: CommandEnum.GET_ACCESS },
  [CommandEnum.JOIN_CHAT]: { text: 'Открыть чат', url: 'https://t.me/openpnbot' },

  [CommandEnum.PAY_WITH_YOOMONEY]: { text: '💳 картой РФ', callback_data: CommandEnum.PAY_WITH_YOOMONEY },
  [CommandEnum.CONFIRM_PAYMENT]: {
    text: '✅ Я оплатил',
    callback_data: CommandEnum.CONFIRM_PAYMENT,
  },
};