"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUTTONS = void 0;
const command_enum_1 = require("../enum/command.enum");
const telegraf_1 = require("telegraf");
exports.BUTTONS = {
    [command_enum_1.CommandEnum.BACK]: telegraf_1.Markup.button.callback('⬅ назад', command_enum_1.CommandEnum.BACK),
    [command_enum_1.CommandEnum.HOME]: telegraf_1.Markup.button.callback('📱в меню', command_enum_1.CommandEnum.HOME),
    [command_enum_1.CommandEnum.STATUS]: telegraf_1.Markup.button.callback('ℹ️ Статус', command_enum_1.CommandEnum.STATUS),
    [command_enum_1.CommandEnum.START_CONNECT]: telegraf_1.Markup.button.callback('⚡ Подключиться', command_enum_1.CommandEnum.START_CONNECT),
    [command_enum_1.CommandEnum.TOPUP_BALANCE]: telegraf_1.Markup.button.callback('🔥 Купить', command_enum_1.CommandEnum.TOPUP_BALANCE),
    [command_enum_1.CommandEnum.QUESTION]: telegraf_1.Markup.button.callback('❓ Помощь', command_enum_1.CommandEnum.QUESTION),
    [command_enum_1.CommandEnum.OUTLINE_APPLE]: telegraf_1.Markup.button.url(' для iPhone', 'https://apps.apple.com/us/app/outline-app/id1356177741'),
    [command_enum_1.CommandEnum.OUTLINE_ANDROID]: telegraf_1.Markup.button.url('🤖 для Android', 'https://play.google.com/store/apps/details?id=org.outline.android.client'),
    [command_enum_1.CommandEnum.OUTLINE_DOWNLOADED]: telegraf_1.Markup.button.callback('Уже скачал', command_enum_1.CommandEnum.OUTLINE_DOWNLOADED),
    [command_enum_1.CommandEnum.TARIF_1]: telegraf_1.Markup.button.callback('✅ 1 месяц', command_enum_1.CommandEnum.TARIF_1),
    [command_enum_1.CommandEnum.TARIF_2]: telegraf_1.Markup.button.callback('🔥 3 месяц', command_enum_1.CommandEnum.TARIF_2),
    [command_enum_1.CommandEnum.TARIF_3]: telegraf_1.Markup.button.callback('🚀 6 месяц', command_enum_1.CommandEnum.TARIF_3),
    [command_enum_1.CommandEnum.IAM_PAYED]: telegraf_1.Markup.button.callback('Уже оплатил', command_enum_1.CommandEnum.GET_CONNECT),
    [command_enum_1.CommandEnum.GET_CONNECT]: telegraf_1.Markup.button.callback('получить доступ 🚀', command_enum_1.CommandEnum.GET_CONNECT),
    [command_enum_1.CommandEnum.JOIN_CHAT]: telegraf_1.Markup.button.url('Открыть чат', 'https://t.me/openvpnbot'),
};
//# sourceMappingURL=buttons.const.js.map