import { BUTTONS } from './buttons.const';
import { CommandEnum } from '../../enum/command.enum';
import { Tariff } from '@prisma/client';
import { splitArrayIntoPairs } from '../../utils/split-array-into-pairs';

/**
 * Scene configurations for grammY
 *
 * Migrated from Telegraf version, adapted button format to grammY.
 */
export const SCENES = {
  [CommandEnum.HOME]: {
    navigateText: `👋🏻 Привет!

Добро пожаловать в Banana Bot!`,
    navigateButtons: [
      [BUTTONS[CommandEnum.STATUS]],
      [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]],
    ],
  },
  [CommandEnum.START]: {
    text: `Добро пожаловать!`,
    buttons: [],
    navigateText: `👋🏻 Привет!

Добро пожаловать в Banana Bot!`,
    navigateButtons: [
      [BUTTONS[CommandEnum.STATUS]],
      [BUTTONS[CommandEnum.GET_ACCESS], BUTTONS[CommandEnum.QUESTION]],
    ],
  },
  [CommandEnum.GET_ACCESS]: {
    navigateText:
      'Для получения доступа к VPN тебе нужно пополнить баланс по количеству дней использования.',
    navigateButtons: [[BUTTONS[CommandEnum.HOME]]],
    text: (tariffs: Tariff[], currentBalance: string) =>
      `Периоды пополнения:\n` +
      tariffs
        .map(
          (tariff) =>
            `<b>${BUTTONS[CommandEnum[tariff.name + '_TARIFF']].text}</b>: <i>${
              tariff.period > 99999999990 ? '∞' : tariff.period
            }</i> дней. <b>${tariff.price + 'руб.'}</b>.\n`,
        )
        .join('') +
      `\nТекущий баланс: ${currentBalance}\n\n`,
    buttons: (tariffs: Tariff[]) =>
      splitArrayIntoPairs(tariffs.map((tariff) => BUTTONS[CommandEnum[tariff.name + '_TARIFF']])),
  },
  [CommandEnum.PAYMENT]: {
    text: (balance: string, currentTariff: string) =>
      `
Текущий баланс: ${balance}

Выбран тариф: ${currentTariff}


💳 К оплате принимаются карты РФ:
Visa, MasterCard, МИР.`,
    buttons: [
      [BUTTONS[CommandEnum.PAY_WITH_YOOMONEY]],
      [BUTTONS[CommandEnum.CONFIRM_PAYMENT]],
    ],
  },
  [CommandEnum.STATUS]: {
    text: (username: string, balance: string, connectionsNumber: number) =>
      `Ваш никнейм: @${username}\nВаш баланс: ${balance}\n\nЧисло подключений: ${connectionsNumber}`,
    buttons: [[BUTTONS[CommandEnum.HOME]]],
  },
  [CommandEnum.QUESTION]: {
    text: `Если у тебя есть вопрос, то ты можешь, посмотреть в документацию или задать его в нашем чате.`,
    buttons: [[BUTTONS[CommandEnum.JOIN_CHAT]]],
  },
  ERROR: (message: string) => ({
    navigateText: `Прошу прошения, но у меня тут ошибка: ${message}`,
    navigateButtons: [[BUTTONS[CommandEnum.HOME]]],
  }),
};