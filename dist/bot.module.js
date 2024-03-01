"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const all_exception_filter_1 = require("./filters/all-exception.filter");
const bot_name_const_1 = require("./constants/bot-name.const");
const bot_service_1 = require("./bot.service");
const bot_update_1 = require("./bot.update");
const axios_1 = require("@nestjs/axios");
const prisma_module_1 = require("./prisma/prisma.module");
const connection_service_1 = require("./prisma/connection.service");
const user_service_1 = require("./prisma/user.service");
const nestjs_telegraf_1 = require("nestjs-telegraf");
const config_1 = require("@nestjs/config");
const start_scene_1 = require("./scenes/start.scene");
const command_args_middleware_1 = require("./middlewares/command-args.middleware");
const telegraf_1 = require("telegraf");
const home_scene_1 = require("./scenes/home.scene");
const question_scene_1 = require("./scenes/question.scene");
const startconnect_scene_1 = require("./scenes/startconnect.scene");
const outline_controller_1 = require("./outline/outline.controller");
const outline_service_1 = require("./outline/outline.service");
const topupbalance_scene_1 = require("./scenes/topupbalance.scene");
const getconnect_scene_1 = require("./scenes/getconnect.scene");
const status_scene_1 = require("./scenes/status.scene");
let BotModule = class BotModule {
};
exports.BotModule = BotModule;
exports.BotModule = BotModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            nestjs_telegraf_1.TelegrafModule.forRootAsync({
                botName: bot_name_const_1.BOT_NAME,
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    token: process.env.BOT_TOKEN,
                    middlewares: [(0, telegraf_1.session)(), (0, command_args_middleware_1.commandArgs)()],
                    include: [BotModule],
                }),
            }),
            prisma_module_1.PrismaModule,
            axios_1.HttpModule,
        ],
        controllers: [
            outline_controller_1.OutlineController
        ],
        providers: [
            {
                provide: core_1.APP_FILTER,
                useClass: all_exception_filter_1.AllExceptionFilter,
            },
            bot_service_1.BotService,
            user_service_1.UserService,
            connection_service_1.ConnectionService,
            bot_update_1.BotUpdate,
            start_scene_1.StartScene,
            home_scene_1.HomeScene,
            startconnect_scene_1.StartConnectScene,
            topupbalance_scene_1.TopupBalanceScene,
            getconnect_scene_1.GetConnectScene,
            question_scene_1.QuestionScene,
            status_scene_1.StatusScene,
            connection_service_1.ConnectionService,
            user_service_1.UserService, outline_service_1.OutlineService,
        ],
        exports: [bot_service_1.BotService],
    })
], BotModule);
//# sourceMappingURL=bot.module.js.map