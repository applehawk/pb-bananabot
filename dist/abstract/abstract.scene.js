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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractScene = void 0;
const nestjs_telegraf_1 = require("nestjs-telegraf");
const common_1 = require("@nestjs/common");
const scenes_const_1 = require("../constants/scenes.const");
const telegraf_1 = require("telegraf");
class AbstractScene {
    constructor() {
        this.logger = new common_1.Logger(AbstractScene.name);
    }
    async sceneReply(ctx, scene) {
        if (scene.navigateButtons && scene.navigateText) {
            await ctx.replyWithHTML(scene.navigateText, telegraf_1.Markup.keyboard(scene.navigateButtons).resize());
        }
        if (!scene.navigateButtons && !scene.buttons) {
            if (scene.text) {
                await ctx.replyWithHTML(scene.text);
            }
            else {
                await ctx.replyWithHTML(scene.navigateText);
            }
        }
        if (scene.buttons && scene.text) {
            await ctx.replyWithHTML(scene.text, telegraf_1.Markup.inlineKeyboard(scene.buttons));
        }
    }
    async onSceneEnter(ctx) {
        this.logger.log(ctx.scene.session.current);
        const scene = scenes_const_1.SCENES[ctx.scene.session.current];
        await this.sceneReply(ctx, scene);
    }
    async onSceneLeave(ctx) {
        this.logger.log(ctx.scene.session.current);
        const scene = scenes_const_1.SCENES[ctx.scene.session.current];
    }
}
exports.AbstractScene = AbstractScene;
__decorate([
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AbstractScene.prototype, "sceneReply", null);
__decorate([
    (0, nestjs_telegraf_1.SceneEnter)(),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AbstractScene.prototype, "onSceneEnter", null);
__decorate([
    (0, nestjs_telegraf_1.SceneLeave)(),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AbstractScene.prototype, "onSceneLeave", null);
//# sourceMappingURL=abstract.scene.js.map