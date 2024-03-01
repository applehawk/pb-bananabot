import { Response } from 'express';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/prisma/user.service';
import { OutlineService } from 'src/outline/outline.service';
export declare class OutlineController {
    private connService;
    private outlineService;
    private userService;
    constructor(connService: ConnectionService, outlineService: OutlineService, userService: UserService);
    createUser(res: Response, tgid: string, firstname: string, lastname?: string, nickname?: string): Promise<void>;
    getConnection(res: Response, version: string, tgIdHex: string, connIdHex: string, connName: string): Promise<void>;
    createConnection(res: Response, tgid: string, connName: string, lastConn: boolean): Promise<void>;
    handleConfig(res: Response, version: string, tgIdHex: string, connIdHex: string): Promise<void>;
}
