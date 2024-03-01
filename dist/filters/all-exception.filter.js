"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const telegraf_1 = require("telegraf");
const scenes_const_1 = require("../constants/scenes.const");
const nestjs_telegraf_1 = require("nestjs-telegraf");
let AllExceptionFilter = AllExceptionFilter_1 = class AllExceptionFilter {
    async catch(exception, host) {
        const telegrafHost = nestjs_telegraf_1.TelegrafArgumentsHost.create(host);
        const ctx = telegrafHost.getContext();
        const scene = scenes_const_1.SCENES.ERROR(exception.message);
        if (!['private'].includes(ctx?.message?.chat?.type))
            return;
        common_1.Logger.error(exception.message, exception.stack, AllExceptionFilter_1.name);
        await ctx.replyWithHTML(scene.navigateText, telegraf_1.Markup.keyboard(scene.navigateButtons).resize());
    }
};
exports.AllExceptionFilter = AllExceptionFilter;
exports.AllExceptionFilter = AllExceptionFilter = AllExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionFilter);
//# sourceMappingURL=all-exception.filter.js.map