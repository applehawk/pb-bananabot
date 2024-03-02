import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) {}

    async user(
        userWhereUniqueInput: Prisma.UserWhereUniqueInput,
      ): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: userWhereUniqueInput
        });
      }

      async limitExceedWithUser(user: User) : Promise<boolean> {
        return this.prisma.connection
            .count({where: { userId: user.userId }})
            .then( count => {
              return count > user.connLimit
            })
      }
      
      async limitExceedWithTgId(userId: number) : Promise<boolean> {
        return new Promise<boolean>( _ => { 
          return this.findOneByUserId(userId).then( user => {
            this.prisma.connection.count({where: { userId: user.userId }}).then( count => {
              return count > user.connLimit
            })
          }) 
        })
      }

      async findOneByUserId(userId: number): Promise<User | null> {
        return this.userFirst({where: { userId: userId } })
      }

      async userFirst(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.UserWhereUniqueInput;
        where?: Prisma.UserWhereInput;
        orderBy?: Prisma.UserOrderByWithRelationInput;
      }): Promise<User | null> {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.user.findFirst({
          skip,
          take,
          cursor,
          where,
          orderBy,
        })
      }

      async users(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.UserWhereUniqueInput;
        where?: Prisma.UserWhereInput;
        orderBy?: Prisma.UserOrderByWithRelationInput;
      }): Promise<User[]> {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.user.findMany({
          skip,
          take,
          cursor,
          where,
          orderBy,
        });
      }
    

    async createUser(data: Prisma.UserCreateInput): Promise<User> {
      return this.prisma.user.create({
          data,
      });
    }

    async upsert(data: User): Promise<User | null> {
      return this.prisma.user.upsert( {
        where: {userId: data.userId}, create: data, update: data
      })
    }

    async updateUser(params: {
        where: Prisma.UserWhereUniqueInput;
        data: Prisma.UserUpdateInput;
      }): Promise<User> {
        const { where, data } = params;
        return this.prisma.user.update({
          data,
          where,
        });
      }
    
    async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
        where,
    });
    }
}