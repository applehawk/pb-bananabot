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
exports.GetConnectScene = void 0;
const nestjs_telegraf_1 = require("nestjs-telegraf");
const command_enum_1 = require("../enum/command.enum");
const abstract_scene_1 = require("../abstract/abstract.scene");
const scenes_const_1 = require("../constants/scenes.const");
const outline_service_1 = require("../outline/outline.service");
const connection_service_1 = require("../prisma/connection.service");
let GetConnectScene = class GetConnectScene extends abstract_scene_1.AbstractScene {
    constructor(outlineService, connService) {
        super();
        this.outlineService = outlineService;
        this.connService = connService;
    }
    async onSceneEnter(ctx) {
        const tgid = ctx.from.id;
        this.logger.log(ctx.scene.session.current);
        const connection = await this.outlineService.createConnection(ctx.from.id, "OpenPNBot")
            .catch(reason => {
            return this.connService.connections({ where: { tgid: tgid } })
                .then(connections => connections.reduce((acc, curr) => curr, null));
        });
        console.log(connection);
        const outlineLink = this.outlineService.getOutlineDynamicLink(connection);
        console.log(outlineLink);
        const scene = scenes_const_1.SCENES.GET_CONNECT(outlineLink);
        this.sceneReply(ctx, scene);
    }
};
exports.GetConnectScene = GetConnectScene;
__decorate([
    (0, nestjs_telegraf_1.SceneEnter)(),
    __param(0, (0, nestjs_telegraf_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GetConnectScene.prototype, "onSceneEnter", null);
exports.GetConnectScene = GetConnectScene = __decorate([
    (0, nestjs_telegraf_1.Scene)(command_enum_1.CommandEnum.GET_CONNECT),
    __metadata("design:paramtypes", [outline_service_1.OutlineService,
        connection_service_1.ConnectionService])
], GetConnectScene);
//# sourceMappingURL=getconnect.scene.js.map