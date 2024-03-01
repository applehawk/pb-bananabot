"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartConnectScene = void 0;
const nestjs_telegraf_1 = require("nestjs-telegraf");
const command_enum_1 = require("../enum/command.enum");
const abstract_scene_1 = require("../abstract/abstract.scene");
let StartConnectScene = class StartConnectScene extends abstract_scene_1.AbstractScene {
};
exports.StartConnectScene = StartConnectScene;
exports.StartConnectScene = StartConnectScene = __decorate([
    (0, nestjs_telegraf_1.Scene)(command_enum_1.CommandEnum.START_CONNECT)
], StartConnectScene);
//# sourceMappingURL=startconnect.scene.js.map