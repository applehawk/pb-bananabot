import { CommandEnum } from '../enum/command.enum';
import { Markup } from 'telegraf';

export const BUTTONS = {
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  //
  [CommandEnum.HOME]: Markup.button.callback('📱в меню', CommandEnum.HOME),

  [CommandEnum.STATUS]: Markup.button.callback('ℹ️ Статус', CommandEnum.STATUS),
  [CommandEnum.START_CONNECT]: Markup.button.callback('⚡ Подключиться', CommandEnum.START_CONNECT),
  [CommandEnum.TOPUP_BALANCE]: Markup.button.callback('🔥 Купить', CommandEnum.TOPUP_BALANCE),
  [CommandEnum.QUESTION]: Markup.button.callback('❓ Помощь', CommandEnum.QUESTION),

  [CommandEnum.OUTLINE_APPLE]: Markup.button.url(' для iPhone','https://apps.apple.com/us/app/outline-app/id1356177741'),
  [CommandEnum.OUTLINE_ANDROID]: Markup.button.url('🤖 для Android','https://play.google.com/store/apps/details?id=org.outline.android.client'),
  [CommandEnum.OUTLINE_DOWNLOADED]: Markup.button.callback('Уже скачал', CommandEnum.OUTLINE_DOWNLOADED),

  [CommandEnum.PAY_WITH_YOOMONEY]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_YOOMONEY),
  [CommandEnum.TARIF_1]: Markup.button.callback('✅ 1 месяц', CommandEnum.TARIF_1),
  [CommandEnum.TARIF_2]: Markup.button.callback('🔥 3 месяц', CommandEnum.TARIF_2),
  [CommandEnum.TARIF_3]:  Markup.button.callback('🚀 6 месяц', CommandEnum.TARIF_3),
  [CommandEnum.IAM_PAYED]:  Markup.button.callback('Уже оплатил', CommandEnum.GET_CONNECT),

  [CommandEnum.GET_CONNECT]: Markup.button.callback('получить доступ 🚀', CommandEnum.GET_CONNECT),
  [CommandEnum.JOIN_CHAT]: Markup.button.url('Открыть чат', 'https://t.me/openvpnbot'),
  //[CommandEnum.PAY_WITH_YOOMONEY_2]: Markup.button.callback('🔥 3 месяц', CommandEnum.PAY_WITH_YOOMONEY_2),
  //[CommandEnum.PAY_WITH_YOOMONEY_3]: Markup.button.callback('🚀 6 месяц', CommandEnum.PAY_WITH_YOOMONEY_3),
  //[CommandEnum.PAY_WITH_YOOKASSA]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_YOOKASSA),
  //[CommandEnum.CONFIRM_PAYMENT]: Markup.button.callback('✅ Я оплатил', CommandEnum.CONFIRM_PAYMENT),
};
