import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Connection } from '@prisma/client';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/prisma/user.service';
export declare class OutlineService {
    private readonly configService;
    private readonly userService;
    private readonly connService;
    private readonly httpService;
    readonly apiUrl: string;
    readonly vpnDomain: string;
    readonly outlineUsersGateway: string;
    readonly version: string;
    constructor(configService: ConfigService, userService: UserService, connService: ConnectionService, httpService: HttpService);
    getOutlineDynamicLink(connection: Connection): string;
    createConnection(tgid: number, connName: string): Promise<Connection>;
    private parseOutlineAccessUrl;
    private renameKey;
    private createNewKey;
}
