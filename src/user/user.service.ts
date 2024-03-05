import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, BalanceChange } from '@prisma/client';
import { BalanceChangeTypeEnum } from 'src/payment/enum/balancechange-type.enum';
import { BalanceChangeStatusEnum } from 'src/payment/enum/balancechange-status.enum';

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

      async findUserByUsername(username: string): Promise<User | null> {
        return this.userFirst({where: { username: username } })
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

      async commitBalanceChange(user: User, change: number, 
        type: BalanceChangeTypeEnum, paymentId?: string): Promise<BalanceChange> {
        
        const status: BalanceChangeStatusEnum = 
        (user.balance + change)  <= 0 ? 
          BalanceChangeStatusEnum.INSUFFICIENT : 
          BalanceChangeStatusEnum.DONE

        const balanceEntry: Prisma.BalanceChangeCreateInput = {
          userId: user.userId,
          changeAmount: change,
          paymentId: paymentId,
          balance: user.balance,
          type: BalanceChangeTypeEnum[type],
          status: status,
        }

        return this.prisma.balanceChange.create({data: balanceEntry}).then( async balanceChange => {
          if (status == BalanceChangeStatusEnum.DONE) { //we change balance only if balanceChange is DONE
            await this.updateUser({where: {userId: user.userId}, data: {
              balance: user.balance + balanceChange.changeAmount
            }})
          }
          return balanceChange
        })
      }

      async usersWithBalance(greaterOrEqual: number): Promise<User[]> {
        return this.prisma.user.findMany({
          where: {
            balance: {
              gte: greaterOrEqual
            }
          }
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

    async upsert(user: User): Promise<User | null> {
      const createUser: Prisma.UserCreateInput = {
        userId: user.userId,
        chatId: user.chatId,
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        balance: user.balance, connLimit: user.connLimit
      }
      const updateUser: Prisma.UserUpdateInput = {
        userId: user.userId,
        chatId: user.chatId,
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username, //exclude balance and connLimit
      }
      return this.prisma.user.upsert( {
        where: {userId: user.userId}, create: createUser, update: updateUser
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