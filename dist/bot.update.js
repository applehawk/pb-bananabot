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
var BotUpdate_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotUpdate = void 0;
const common_1 = require("@nestjs/common");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const telegraf_1 = require("telegraf");
const bot_service_1 = require("./bot.service");
const bot_name_const_1 = require("./constants/bot-name.const");
const all_exception_filter_1 = require("./filters/all-exception.filter");
const response_time_interceptor_service_1 = require("./interceptors/response-time-interceptor.service");
const command_enum_1 = require("./enum/command.enum");
const buttons_const_1 = require("./constants/buttons.const");
const config_1 = require("@nestjs/config");
const user_service_1 = require("./prisma/user.service");
let BotUpdate = BotUpdate_1 = class BotUpdate {
    constructor(bot, botService, configService, userService) {
        this.bot = bot;
        this.botService = botService;
        this.configService = configService;
        this.userService = userService;
        this.logger = new common_1.Logger(BotUpdate_1.name);
        this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
    }
    async onStart(ctx) {
        const message = ctx.update.message;
        if (!['private'].includes(message.chat.type)) {
            await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
                reply_markup: {
                    remove_keyboard: true,
                },
            });
            return;
        }
        ctx.session.messageId = undefined;
        await this.botService.upsertUser(ctx);
        await ctx.scene.enter(command_enum_1.CommandEnum.START);
    }
    async onAnswer(ctx) {
        this.logger.log(ctx);
        try {
            const cbQuery = ctx.update.callback_query;
            if (!['private'].includes(cbQuery.message.chat.type))
                return;
            const nextStep = 'data' in cbQuery ? cbQuery.data : null;
            await ctx.scene.enter(nextStep);
        }
        catch (e) {
            this.logger.log(e);
        }
    }
    async onMenuHears(ctx) {
        const message = ctx.update.message;
        if (!['private'].includes(message.chat.type))
            return;
        try {
            this.logger.log('hears', ctx.message);
            const existUser = await this.userService.findOneByUserId(ctx.from.id);
            if (existUser) {
                ctx.scene.enter(command_enum_1.CommandEnum.HOME);
            }
            else {
                ctx.scene.enter(command_enum_1.CommandEnum.START);
            }
        }
        catch (e) {
            this.logger.log(e);
        }
    }
    async onHears(ctx) {
        this.logger.log("onHears");
        const user = await this.userService.findOneByUserId(ctx.from.id);
        try {
            const message = ctx.update.message;
            const [command] = Object.entries(buttons_const_1.BUTTONS).find(([_, button]) => button.text === message.text);
            if (!['private'].includes(message.chat.type))
                return;
            this.logger.log('stats', ctx.message);
            ctx.scene.enter(command);
        }
        catch (e) {
            this.logger.log(e);
        }
    }
    isAdmin(ctx) {
        return ctx.chat.id === this.adminChatId;
    }
};
exports.BotUpdate = BotUpdate;
__decorate([
    (0, nestjs_telegraf_1.Start)(),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BotUpdate.prototype, "onStart", null);
__decorate([
    (0, nestjs_telegraf_1.Action)(/.*/),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BotUpdate.prototype, "onAnswer", null);
__decorate([
    (0, nestjs_telegraf_1.Hears)(buttons_const_1.BUTTONS[command_enum_1.CommandEnum.HOME].text),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BotUpdate.prototype, "onMenuHears", null);
__decorate([
    (0, nestjs_telegraf_1.Hears)(/.*/),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BotUpdate.prototype, "onHears", null);
exports.BotUpdate = BotUpdate = BotUpdate_1 = __decorate([
    (0, common_1.UseInterceptors)(response_time_interceptor_service_1.ResponseTimeInterceptor),
    (0, common_1.UseFilters)(all_exception_filter_1.AllExceptionFilter),
    (0, nestjs_telegraf_1.Update)(),
    __param(0, (0, nestjs_telegraf_1.InjectBot)(bot_name_const_1.BOT_NAME)),
    __metadata("design:paramtypes", [telegraf_1.Telegraf,
        bot_service_1.BotService,
        config_1.ConfigService,
        user_service_1.UserService])
], BotUpdate);
//# sourceMappingURL=bot.update.js.map