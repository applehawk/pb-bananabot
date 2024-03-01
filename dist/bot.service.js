"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotService = void 0;
const common_1 = require("@nestjs/common");
const telegraf_1 = require("telegraf");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const scenes_const_1 = require("./constants/scenes.const");
const command_enum_1 = require("./enum/command.enum");
const bot_name_const_1 = require("./constants/bot-name.const");
const config_1 = require("@nestjs/config");
const reply_or_edit_1 = require("./utils/reply-or-edit");
const user_service_1 = require("./prisma/user.service");
let BotService = BotService_1 = class BotService {
    constructor(bot, configService, userService) {
        this.bot = bot;
        this.configService = configService;
        this.userService = userService;
        this.logger = new common_1.Logger(BotService_1.name);
        common_1.Logger.log("constructor BotService");
        this.chatId = configService.get('CHAT_ID');
        this.adminChatId = configService.get('ADMIN_CHAT_ID');
        this.isProd = configService.get('NODE_ENV') === 'production';
    }
    async start(ctx) {
        await (0, reply_or_edit_1.replyOrEdit)(ctx, scenes_const_1.SCENES[command_enum_1.CommandEnum.START].navigateText, telegraf_1.Markup.inlineKeyboard(scenes_const_1.SCENES[command_enum_1.CommandEnum.START].navigateButtons));
    }
    async upsertUser(ctx) {
        const newUser = {
            tgid: ctx.from.id,
            chatId: ctx.chat.id,
            firstname: ctx.from.first_name,
            lastname: ctx.from.last_name,
            nickname: ctx.from.username,
            connLimit: 1
        };
        this.userService.upsert(newUser);
    }
};
exports.BotService = BotService;
exports.BotService = BotService = BotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)(bot_name_const_1.BOT_NAME)),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        config_1.ConfigService,
        user_service_1.UserService])
], BotService);
//# sourceMappingURL=bot.service.js.map