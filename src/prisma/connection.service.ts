import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Connection, Prisma } from '@prisma/client';

@Injectable()
export class ConnectionService {
    constructor(private prisma: PrismaService) {}

    getOutlineDynamicLink(connection: Connection) {
      //telegramId: string | number, connName: string, connId: number
      let tgIdHex: string = (+connection.tgid).toString(16)
      let connIdHex: string = (+connection.key_id).toString(16)
      let connName: string = connection.name

      return`${tgIdHex}/${connIdHex}/${connName}`
    }

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
    

    async createConnection(data: Prisma.ConnectionCreateInput): Promise<Connection> {
    return this.prisma.connection.create({
        data,
    });
    }

    async updateConnnection(params: {
        where: Prisma.ConnectionWhereUniqueInput;
        data: Prisma.ConnectionUpdateInput;
      }): Promise<Connection> {
        const { where, data } = params;
        return this.prisma.connection.update({
          data,
          where,
        });
      }
    
    async deleteConnection(where: Prisma.ConnectionWhereUniqueInput): Promise<Connection> {
    return this.prisma.connection.delete({
        where,
    });
    }
}