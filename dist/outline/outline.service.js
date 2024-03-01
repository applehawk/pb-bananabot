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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlineService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const connection_service_1 = require("../prisma/connection.service");
const user_service_1 = require("../prisma/user.service");
let OutlineService = class OutlineService {
    constructor(configService, userService, connService, httpService) {
        this.configService = configService;
        this.userService = userService;
        this.connService = connService;
        this.httpService = httpService;
        this.outlineUsersGateway = "users.outline.yourvpn.io";
        this.version = "v1";
        this.apiUrl = this.configService.get('OUTLINE_API_URL');
        this.vpnDomain = this.configService.get('VPN_SERVER');
        this.outlineUsersGateway = this.vpnDomain;
        console.log('OUTLINE_API_URL: ' + this.apiUrl);
        console.log('VPN_SERVER: ' + this.vpnDomain);
    }
    getOutlineDynamicLink(connection) {
        let tgIdHex = (+connection.tgid).toString(16);
        let connIdHex = (+connection.key_id).toString(16);
        let connName = connection.name;
        return `ssconf://${this.outlineUsersGateway}/conf/${this.version}/${tgIdHex}/${connIdHex}/${connName}`;
    }
    getConnectionRedirectLink(connection) {
        let tgIdHex = (+connection.tgid).toString(16);
        let connIdHex = (+connection.key_id).toString(16);
        let connName = connection.name;
        return `https://${this.outlineUsersGateway}/redirect/${this.version}/${tgIdHex}/${connIdHex}/${connName}`;
    }
    async createConnection(tgid, connName) {
        return this.userService
            .userFirst({ where: { tgid: tgid } })
            .then(user => this.userService.limitExceedWithUser(user)
            .then(isExceed => {
            console.log(`isExceed = ${isExceed}`);
            return isExceed == false ?
                this.createNewKey(tgid)
                    .then(newKey => this.parseOutlineAccessUrl(newKey.accessUrl))
                    .then(newConn => this.connService.createConnectionEntryWithOutlineConn(user, connName, newConn))
                : Promise.reject("Limit exceed");
        }));
    }
    parseOutlineAccessUrl(accessUrl) {
        console.log(accessUrl);
        let regexKey = /ss:\/\/(\w+)@(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\w+)\//g;
        let [regexKeyMatch, encodedBase64Key, serverAddress, port] = [...accessUrl.matchAll(regexKey)][0];
        console.log(`url64code: ${encodedBase64Key}, serverAddress: ${serverAddress}, port: ${port}`);
        let decodedBase64Key = atob(encodedBase64Key);
        let regexBase64Key = /(.+):(.+)/g;
        let [regexBase64KeyMatch, encrypt_method, password] = [...decodedBase64Key.matchAll(regexBase64Key)][0];
        let outlineConn = { serverAddress: serverAddress, port: port, encrypt_method: encrypt_method, password: password, accessUrl: accessUrl };
        return outlineConn;
    }
    async renameKey(keyId, keyName) {
        const url = `${this.apiUrl}/access-keys/${keyId}/name`;
        return this.httpService.axiosRef.put(url, { "name": keyName });
    }
    async createNewKey(withTelegramId) {
        let url = `${this.apiUrl}/access-keys`;
        let tgIdStr = withTelegramId.toString();
        return this.httpService.axiosRef.post(url)
            .then(response => this.renameKey(response.data.id, tgIdStr)
            .then(_ => response.data));
    }
};
exports.OutlineService = OutlineService;
exports.OutlineService = OutlineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        user_service_1.UserService,
        connection_service_1.ConnectionService,
        axios_1.HttpService])
], OutlineService);
//# sourceMappingURL=outline.service.js.map