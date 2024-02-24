import { BUTTONS } from './buttons.const';
import { CommandEnum } from '../enum/command.enum';
import { buffer } from 'stream/consumers';

export const SCENES = {
  [CommandEnum.START]: {
    navigateText:
      `👋🏻 Привет!  

      Это Telegram-бот для подключения к VPN.

      Доступны локации: 
├ 🇦🇪 ОАЭ`,
navigateButtons: [
      [BUTTONS[CommandEnum.START_CONNECT]],
    ]
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
      [BUTTONS[CommandEnum.OUTLINE_DOWNLOADED]]
    ],
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
    buttons: [
      [BUTTONS[CommandEnum.JOIN_CHAT], BUTTONS[CommandEnum.DOCUMENTATION]],
    ]
  },
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
  }),
};
