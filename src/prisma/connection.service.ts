import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Connection, Prisma } from '@prisma/client';
import { User } from '@prisma/client';

interface OutlineSSConnection {
  serverAddress: string,
  port: string,
  encrypt_method: string,
  password: string,
  accessUrl: string
}

@Injectable()
export class ConnectionService {
    constructor(private prisma: PrismaService) {}

    async connectionFirst(params: {
      skip?: number;
      take?: number;
      cursor?: Prisma.ConnectionWhereUniqueInput;
      where?: Prisma.ConnectionWhereInput;
      orderBy?: Prisma.ConnectionOrderByWithRelationInput;
    }): Promise<Connection | null> {
      const { skip, take, cursor, where, orderBy } = params;
      return this.prisma.connection.findFirst({
        skip,
        take,
        cursor,
        where,
        orderBy,
      })
    }

    async connection(
        connWhereUniqueInput: Prisma.ConnectionWhereUniqueInput,
      ): Promise<Connection | null> {
        return this.prisma.connection.findUnique({
            where: connWhereUniqueInput
        });
      }

      async connections(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.ConnectionWhereUniqueInput;
        where?: Prisma.ConnectionWhereInput;
        orderBy?: Prisma.ConnectionOrderByWithRelationInput;
      }): Promise<Connection[]> {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.connection.findMany({
          skip,
          take,
          cursor,
          where,
          orderBy,
        });
      }
    
    async count(): Promise<number> {
      return this.prisma.connection.count()
    }

    async createConnectionEntry(data: Prisma.ConnectionCreateInput): Promise<Connection> {
    return this.prisma.connection.create({
        data,
    });
    }

    async createConnectionEntryWithOutlineConn(user: User, connName: string, outlineConnKey: OutlineSSConnection) {
      const newKey = outlineConnKey
      return this.createConnectionEntry({
          name: connName,
          server: newKey.serverAddress,
          server_port: newKey.port,
          method: newKey.encrypt_method,
          access_url: newKey.accessUrl,
          password: newKey.password,
          user: {
              connect: { userId: user.userId }
          }
      });
  }


    async updateConnnectionEntry(params: {
        where: Prisma.ConnectionWhereUniqueInput;
        data: Prisma.ConnectionUpdateInput;
      }): Promise<Connection> {
        const { where, data } = params;
        return this.prisma.connection.update({
          data,
          where,
        });
      }
    
    async deleteConnectionEntry(where: Prisma.ConnectionWhereUniqueInput): Promise<Connection> {
    return this.prisma.connection.delete({
        where,
    });
    }
}