"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENES = void 0;
const buttons_const_1 = require("./buttons.const");
const command_enum_1 = require("../enum/command.enum");
exports.SCENES = {
    [command_enum_1.CommandEnum.START]: {
        navigateText: `👋🏻 Привет!  

      Это Telegram-бот для подключения к VPN.

      Доступны локации: 
├ 🇦🇪 ОАЭ`,
        navigateButtons: [
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.STATUS], buttons_const_1.BUTTONS[command_enum_1.CommandEnum.GET_CONNECT]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TOPUP_BALANCE], buttons_const_1.BUTTONS[command_enum_1.CommandEnum.QUESTION]]
        ]
    },
    [command_enum_1.CommandEnum.HOME]: {
        text: `Чтобы подключиться к VPN нужно:
    Скачать приложение Outline на свой телефон:
      Apple: https://apps.apple.com/us/app/outline-app/id1356177741
      Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
      Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
    ‌если не работает для Android ссылка 1, используйте ссылку 2.`,
        buttons: [
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.OUTLINE_APPLE], buttons_const_1.BUTTONS[command_enum_1.CommandEnum.OUTLINE_ANDROID]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TOPUP_BALANCE]]
        ],
    },
    [command_enum_1.CommandEnum.START_CONNECT]: {
        text: `Чтобы подключиться к VPN нужно:
Скачать приложение Outline на свой телефон:
  Apple: https://apps.apple.com/us/app/outline-app/id1356177741
  Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
  Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
‌если не работает для Android ссылка 1, используйте ссылку 2.`,
        buttons: [
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.OUTLINE_APPLE], buttons_const_1.BUTTONS[command_enum_1.CommandEnum.OUTLINE_ANDROID]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TOPUP_BALANCE]]
        ],
    },
    [command_enum_1.CommandEnum.TOPUP_BALANCE]: {
        text: `Для полного доступа выберите удобный для вас тариф:

    190₽ / 1 мес
    500₽ / 3 мес
    900₽ / 6 мес
    
    💳 К оплате принимаются карты РФ:
    Visa, MasterCard, МИР.`,
        buttons: [
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TARIF_1]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TARIF_2]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.TARIF_3]],
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.IAM_PAYED]]
        ]
    },
    [command_enum_1.CommandEnum.GET_CONNECT]: (connectionLink) => ({
        text: `Подключение к Outline:  

    Ваша ссылка:
    └ <code>${connectionLink}</code>
    Нажмите чтобы скопировать (тапните) и добавьте в приложение
    
    Если приложение уже установлено - воспользуйтесь быстрым подключением
    - Outline - для iOS 🍏
    - Outline - для Android 🤖`,
        buttons: []
    }),
    [command_enum_1.CommandEnum.STATUS]: {
        text: `Ваш статус`,
    },
    [command_enum_1.CommandEnum.QUESTION]: {
        text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
        buttons: [
            [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.JOIN_CHAT]],
        ]
    },
    ERROR: (message) => ({
        navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
        navigateButtons: [buttons_const_1.BUTTONS[command_enum_1.CommandEnum.HOME]],
    }),
};
//# sourceMappingURL=scenes.const.js.map