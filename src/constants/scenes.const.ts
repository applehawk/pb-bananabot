import { BUTTONS } from './buttons.const';
import { CommandEnum } from '../enum/command.enum';
import { buffer } from 'stream/consumers';
import { Markup } from 'telegraf';
import { Tariff } from '@prisma/client';
import { Command } from 'nestjs-telegraf';
import { splitArrayIntoPairs } from 'src/utils/split-array-into-pairs';

export const SCENES = {
  [CommandEnum.HOME]: {
    navigateText:
      `👋🏻 Привет!  

      Это Telegram-бот для подключения к VPN.

      Доступны локации: 
├ 🇳🇱 Нидерланды`,
  navigateButtons: [
    [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.CONNECT]],
    [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]]
  ]},
  [CommandEnum.START]: {
    text: `Чтобы подключиться к VPN нужно:
    Скачать приложение Outline на свой телефон:
      Apple: https://apps.apple.com/us/app/outline-app/id1356177741
      Android (ссылка 1): https://play.google.com/store/apps/details?id=org.outline.android.client
      Android (ссылка 2): https://s3.amazonaws.com/outline-releases/client/android/stable/Outline-Client.apk
    ‌если не работает для Android ссылка 1, используйте ссылку 2.`,  
    buttons: [
      [BUTTONS[CommandEnum.OUTLINE_APPLE], BUTTONS[CommandEnum.OUTLINE_ANDROID]]
    ],
    navigateText:
      `👋🏻 Привет!  

      Это Telegram-бот для подключения к VPN.

      Доступны локации: 
├ 🇦🇪 ОАЭ`,
  navigateButtons: [
    [BUTTONS[CommandEnum.STATUS], BUTTONS[CommandEnum.CONNECT]],
    [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]]
    ]
  },
  [CommandEnum.GET_ACCESS]: {
    navigateText: 'Для получения доступа к VPN тебе нужно пополнить баланс по количеству дней использования.',
    navigateButtons: [BUTTONS[CommandEnum.HOME]],
    text: (tariffs: Tariff[], currentBalance: string) =>
      `Периоды пополнения:\n`+
      tariffs.map((tariff) =>
        `<b>${BUTTONS[CommandEnum[tariff.name + '_TARIFF']].text}</b>: <i>${
          tariff.period > 99999999990 ? '∞' : tariff.period
        }</i> дней. <b>${tariff.price + 'руб.'}</b>.\n`,).join('') + `\nТекущий баланс: ${currentBalance}\n\n`,
    buttons: (tariffs: Tariff[]) =>
      splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']])),
  },
  [CommandEnum.PAYMENT]: { //попадаем только через GET_ACCESS, чтобы был выбран Тариф
    text: (balance: string, currentTariff: string) =>
    `
    Текущий баланс: ${balance}\n
    Выбран тариф: ${currentTariff}\n\n

    💳 К оплате принимаются карты РФ:
    Visa, MasterCard, МИР.`,
    buttons: [
      [BUTTONS[CommandEnum.PAY_WITH_YOOMONEY]],
      [BUTTONS[CommandEnum.CONFIRM_PAYMENT]]
    ]
  },
  [CommandEnum.CONNECT]: {
    balancePositive: (connectionLink: string ) => ({
      text: `Подключение к Outline:  

      Ваша ссылка:
      └ <code>${connectionLink}</code>
      Нажмите чтобы скопировать (тапните) и добавьте в приложение
      
      Если приложение уже установлено - воспользуйтесь быстрым подключением
      - Outline - для iOS 🍏
      - Outline - для Android 🤖`,
      buttons: []
    })
  },
  [CommandEnum.STATUS]: {
    text: (username: string, balance: string, connectionsNumber: number) => `Ваш никнейм: @${username}\nВаш баланс: ${balance}\n\nЧисло подключений: ${connectionsNumber}`,
    buttons: [BUTTONS[CommandEnum.HOME]],
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
