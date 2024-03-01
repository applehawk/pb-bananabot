import { PrismaService } from './prisma.service';
import { Connection, Prisma } from '@prisma/client';
import { User } from '@prisma/client';
interface OutlineSSConnection {
    serverAddress: string;
    port: string;
    encrypt_method: string;
    password: string;
    accessUrl: string;
}
export declare class ConnectionService {
    private prisma;
    constructor(prisma: PrismaService);
    connectionFirst(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.ConnectionWhereUniqueInput;
        where?: Prisma.ConnectionWhereInput;
        orderBy?: Prisma.ConnectionOrderByWithRelationInput;
    }): Promise<Connection | null>;
    connection(connWhereUniqueInput: Prisma.ConnectionWhereUniqueInput): Promise<Connection | null>;
    connections(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.ConnectionWhereUniqueInput;
        where?: Prisma.ConnectionWhereInput;
        orderBy?: Prisma.ConnectionOrderByWithRelationInput;
    }): Promise<Connection[]>;
    createConnectionEntry(data: Prisma.ConnectionCreateInput): Promise<Connection>;
    createConnectionEntryWithOutlineConn(user: User, connName: string, outlineConnKey: OutlineSSConnection): Promise<{
        key_id: number;
        tgid: number;
        name: string;
        server: string;
        server_port: string;
        password: string;
        method: string;
        access_url: string;
        user_tgid: number;
    }>;
    updateConnnectionEntry(params: {
        where: Prisma.ConnectionWhereUniqueInput;
        data: Prisma.ConnectionUpdateInput;
    }): Promise<Connection>;
    deleteConnectionEntry(where: Prisma.ConnectionWhereUniqueInput): Promise<Connection>;
}
export {};
