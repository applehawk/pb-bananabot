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
exports.ConnectionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let ConnectionService = class ConnectionService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async connectionFirst(params) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.connection.findFirst({
            skip,
            take,
            cursor,
            where,
            orderBy,
        });
    }
    async connection(connWhereUniqueInput) {
        return this.prisma.connection.findUnique({
            where: connWhereUniqueInput
        });
    }
    async connections(params) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.connection.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
        });
    }
    async createConnectionEntry(data) {
        return this.prisma.connection.create({
            data,
        });
    }
    async createConnectionEntryWithOutlineConn(user, connName, outlineConnKey) {
        const newKey = outlineConnKey;
        console.log('createConnectionWithOutlineConn');
        return this.createConnectionEntry({
            tgid: user.tgid,
            name: connName,
            server: newKey.serverAddress,
            server_port: newKey.port,
            method: newKey.encrypt_method,
            access_url: newKey.accessUrl,
            password: newKey.password,
            user: {
                connect: { tgid: user.tgid }
            }
        });
    }
    async updateConnnectionEntry(params) {
        const { where, data } = params;
        return this.prisma.connection.update({
            data,
            where,
        });
    }
    async deleteConnectionEntry(where) {
        return this.prisma.connection.delete({
            where,
        });
    }
};
exports.ConnectionService = ConnectionService;
exports.ConnectionService = ConnectionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ConnectionService);
//# sourceMappingURL=connection.service.js.map