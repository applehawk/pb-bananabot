import { BUTTONS } from './buttons.const';
import { CommandEnum } from '../enum/command.enum';
import { buffer } from 'stream/consumers';
import { Markup } from 'telegraf';

export const SCENES = {
  [CommandEnum.START]: {
    navigateText:
      `👋🏻 Привет!  

      Это Telegram-бот для подключения к VPN.

      Доступны локации: 
├ 🇦🇪 ОАЭ`,
  navigateButtons: [
    [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.GET_CONNECT]],
    [BUTTONS[CommandEnum.TOPUP_BALANCE], BUTTONS[CommandEnum.QUESTION], BUTTONS[CommandEnum.HOME]]
  ]},
  [CommandEnum.HOME]: {
    text: `Чтобы подключиться к VPN нужно:
    Скачать приложение Outline на свой телефон:
      Apple: https://apps.apple.com/us/app/outline-app/id1356177741
      Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
      Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
    ‌если не работает для Android ссылка 1, используйте ссылку 2.`,  
    buttons: [
      [BUTTONS[CommandEnum.OUTLINE_APPLE], BUTTONS[CommandEnum.OUTLINE_ANDROID]],
      [BUTTONS[CommandEnum.TOPUP_BALANCE]]
    ],
  },
  [CommandEnum.START_CONNECT]: {
    text: `Чтобы подключиться к VPN нужно:
Скачать приложение Outline на свой телефон:
  Apple: https://apps.apple.com/us/app/outline-app/id1356177741
  Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
  Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
‌если не работает для Android ссылка 1, используйте ссылку 2.`,
    buttons: [
      [BUTTONS[CommandEnum.OUTLINE_APPLE], BUTTONS[CommandEnum.OUTLINE_ANDROID]],
      [BUTTONS[CommandEnum.TOPUP_BALANCE]]
    ],
  },
  [CommandEnum.TOPUP_BALANCE]: {
    text: `Для полного доступа выберите удобный для вас тариф:

    190₽ / 1 мес
    500₽ / 3 мес
    900₽ / 6 мес
    
    💳 К оплате принимаются карты РФ:
    Visa, MasterCard, МИР.`,
    buttons: [
      [BUTTONS[CommandEnum.PAY_WITH_YOOMONEY]],
      [BUTTONS[CommandEnum.TARIF_2]],
      [BUTTONS[CommandEnum.TARIF_3]],
      [BUTTONS[CommandEnum.IAM_PAYED]]
    ]
  },
  [CommandEnum.GET_CONNECT]: (connectionLink: string ) => ({
    text: `Подключение к Outline:  

    Ваша ссылка:
    └ <code>${connectionLink}</code>
    Нажмите чтобы скопировать (тапните) и добавьте в приложение
    
    Если приложение уже установлено - воспользуйтесь быстрым подключением
    - Outline - для iOS 🍏
    - Outline - для Android 🤖`,
    buttons: []
  }),
  [CommandEnum.STATUS]: {
    text: `Ваш статус`,
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
    buttons: [
      [BUTTONS[CommandEnum.JOIN_CHAT]],
    ]
  },
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};
