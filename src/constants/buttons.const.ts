import { CommandEnum } from '../enum/command.enum';
import { Markup } from 'telegraf';

export const BUTTONS = {
  [CommandEnum.BACK]: Markup.button.callback('⬅ назад', CommandEnum.BACK),
  [CommandEnum.HOME]: Markup.button.callback('📱в меню', CommandEnum.HOME),
  [CommandEnum.START_CONNECT]: Markup.button.callback('Подключиться', CommandEnum.START_CONNECT),
  [CommandEnum.GET_ACCESS]: Markup.button.callback('получить доступ 🚀', CommandEnum.GET_ACCESS),
  [CommandEnum.QUESTION]: Markup.button.callback('помощь', CommandEnum.QUESTION),
  [CommandEnum.JOIN_CHAT]: Markup.button.callback('join chat', CommandEnum.JOIN_CHAT),
  [CommandEnum.DOCUMENTATION]: Markup.button.callback('documentation', CommandEnum.DOCUMENTATION),
  [CommandEnum.OUTLINE_APPLE]: Markup.button.url(' для iPhone','https://apps.apple.com/us/app/outline-app/id1356177741'),
  [CommandEnum.OUTLINE_ANDROID]: Markup.button.url('🤖 для Android','https://play.google.com/store/apps/details?id=org.outline.android.client'),
  [CommandEnum.OUTLINE_DOWNLOADED]: Markup.button.callback('Уже скачал', CommandEnum.OUTLINE_DOWNLOADED),
  //[CommandEnum.PAY_WITH_YOOKASSA]: Markup.button.callback('💳 картой РФ', CommandEnum.PAY_WITH_YOOKASSA),
  //[CommandEnum.CONFIRM_PAYMENT]: Markup.button.callback('✅ Я оплатил', CommandEnum.CONFIRM_PAYMENT),
};
