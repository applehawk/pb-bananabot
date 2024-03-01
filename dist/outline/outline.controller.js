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
exports.OutlineController = void 0;
const common_1 = require("@nestjs/common");
const connection_service_1 = require("../prisma/connection.service");
const user_service_1 = require("../prisma/user.service");
const outline_service_1 = require("./outline.service");
const CONNLIMIT = 1;
let OutlineController = class OutlineController {
    constructor(connService, outlineService, userService) {
        this.connService = connService;
        this.outlineService = outlineService;
        this.userService = userService;
    }
    async createUser(res, tgid, firstname, lastname, nickname) {
        var tgidInt = parseInt(tgid);
        return this.userService.upsert({
            tgid: tgidInt,
            firstname: firstname,
            lastname: lastname,
            nickname: nickname,
            chatId: 0,
            connLimit: CONNLIMIT
        }).then(user => {
            res.status(common_1.HttpStatus.OK).json({
                "id": user.tgid,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "nickname": user.nickname,
                "connLimit": user.connLimit
            });
        });
    }
    async getConnection(res, version, tgIdHex, connIdHex, connName) {
        let tgidInt = parseInt(tgIdHex);
        let connidInt = parseInt(connIdHex);
        return this.connService.connection({ tgid: tgidInt, key_id: connidInt })
            .then(connection => {
            res.status(common_1.HttpStatus.OK).json({
                "url": `${this.outlineService.getOutlineDynamicLink(connection)}`,
                "status": 302,
            });
        });
    }
    async createConnection(res, tgid, connName, lastConn) {
        let tgidInt = parseInt(tgid);
        return this.userService.findOneByUserId(tgidInt)
            .then(user => {
            console.log(`User found: ${user}`);
            return user !== null ? user : Promise.reject("UserNotFound");
        })
            .then(user => this.outlineService.createConnection(tgidInt, connName))
            .then(newConn => {
            res.status(common_1.HttpStatus.OK).json({
                "link": `${this.outlineService.getOutlineDynamicLink(newConn)}`
            });
        })
            .catch((reason) => {
            return this.connService.connections({ where: { tgid: tgidInt } })
                .then(connections => connections.reduce((acc, curr) => curr, null))
                .then(lastConnection => {
                const outlineLink = this.outlineService.getOutlineDynamicLink(lastConnection);
                console.log(`Reason: ${reason}`);
                var jsonResponse = Object.assign({}, { "warning": reason }, lastConn ? { "link": outlineLink } : {});
                res.status(common_1.HttpStatus.NOT_FOUND).json(jsonResponse);
            });
        });
    }
    async handleConfig(res, version, tgIdHex, connIdHex) {
        let tgId = parseInt(tgIdHex, 16);
        let connId = parseInt(connIdHex, 16);
        this.connService.connectionFirst({
            where: { tgid: tgId }
        }).then(connection => {
            res.status(common_1.HttpStatus.OK).json({
                "server": connection.server,
                "server_port": connection.server_port,
                "password": connection.password,
                "method": connection.method
            });
        }).catch(error => {
            res.status(common_1.HttpStatus.NOT_FOUND);
        });
    }
};
exports.OutlineController = OutlineController;
__decorate([
    (0, common_1.Post)('/user/:id'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('firstname')),
    __param(3, (0, common_1.Query)('lastname')),
    __param(4, (0, common_1.Query)('nickname')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], OutlineController.prototype, "createUser", null);
__decorate([
    (0, common_1.Get)('/redirect/:version/:tgIdHex/:connIdHex/:connName'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Param)('tgIdHex')),
    __param(3, (0, common_1.Param)('connIdHex')),
    __param(4, (0, common_1.Param)('connName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], OutlineController.prototype, "getConnection", null);
__decorate([
    (0, common_1.Post)('/user/:id/conn/:connName'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('connName')),
    __param(3, (0, common_1.Query)('lastConn')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Boolean]),
    __metadata("design:returntype", Promise)
], OutlineController.prototype, "createConnection", null);
__decorate([
    (0, common_1.Get)('/conf/:version/:tgIdHex/:connIdHex/:connName'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Param)('version')),
    __param(2, (0, common_1.Param)('tgIdHex')),
    __param(3, (0, common_1.Param)('connIdHex')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], OutlineController.prototype, "handleConfig", null);
exports.OutlineController = OutlineController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [connection_service_1.ConnectionService,
        outline_service_1.OutlineService,
        user_service_1.UserService])
], OutlineController);
//# sourceMappingURL=outline.controller.js.map