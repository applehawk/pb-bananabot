//import { InjectModel } from '@nestjs/mongoose';
//import mongoose, { Model } from 'mongoose';
//import * as ApiKey from 'uuid-apikey';
//import { InjectRedis } from '@liaoliaots/nestjs-redis';
//import Redis from 'ioredis';

import { Injectable, Logger } from '@nestjs/common';
import { Tariff } from '@prisma/client';
import { TariffService } from 'src/tariff/tariff.service';
import { Payment } from '@prisma/client';
import { PaymentSystemEnum } from './enum/payment-system.enum';
import { PaymentStatusEnum } from './enum/payment-status.enum';
import { DateTime } from 'luxon';
import { YooMoneyNotification } from '@app/yoomoney-client/types/notification.type';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { YooMoneyClient } from '@app/yoomoney-client';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly prisma: PrismaService,
    private readonly paymentStrategyFactory: PaymentStrategyFactory,
    private readonly yooMoney: YooMoneyClient
  ) {}

  async getPendingPayments(): Promise<Payment[]> {
    return this.prisma.payment.findMany({ where: { status: PaymentStatusEnum.PENDING }} );
  }
  async findPaymentByPaymentId(paymentId: string): Promise<Payment> {
    return this.prisma.payment.findUnique({ where: { paymentId: paymentId}} );
  }

  async createPayment(
    userId: number,
    chatId: number,
    tariffId: string,
    paymentSystem: PaymentSystemEnum,
    //paymentMonths: number,
    //email?: string,
    paymentAt?: Date,
  ): Promise<Payment> {
    const user = await this.userService.findOneByUserId(userId);

    if (!user) throw new Error('User not found');
    if (!user?.chatId) await this.userService.updateUser( { where: {userId: user.userId}, data: {chatId: user.chatId} })

    console.log(tariffId)
    const tariff: Tariff = await this.tariffService.getOneById(tariffId);
    if (!tariff) throw new Error(`Tariff with id ${tariffId} not found`);

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(paymentSystem);
    const payment = await paymentStrategy.createPayment({
      userId,
      chatId,
      tariffId,
      tariffPrice: tariff.price,
      //paymentMonths,
      //email,
      paymentAt: paymentAt || DateTime.local().toJSDate(),
      //limit: tariff.connectionsLimit,
    });
    return this.prisma.payment.create({data: payment._payment})
  }

  async updatePaymentStatus(paymentId: string, status: string, isFinal: boolean): Promise<void> {
    await this.prisma.payment.update(
      {
        where: {
          paymentId: paymentId
        }, 
        data: {
          status: status, isFinal: isFinal
        }
      })
  }

  async validatePayment(paymentId: string): Promise<boolean> { 
    const payment = await this.findPaymentByPaymentId(paymentId);
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    this.logger.debug(`Payment status: ${PaymentStatusEnum[payment.paymentSystem]}`)
    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(PaymentStatusEnum[payment.paymentSystem]);

    const paymentStatus = await paymentStrategy.validateTransaction(payment.paymentId);
    const isPaid = paymentStatus === PaymentStatusEnum.PAID;

    if(isPaid) {
      if(paymentStatus !== payment.status) { //going to PAID status
        const user = await this.userService.findOneByUserId(payment.userId);
        const tariff = await this.tariffService.getOneById(payment.tariffId);
        if(user) {
          await this.userService.updateUser({where: {userId: user.userId}, data: {
            balance: user.balance + tariff.price
          }})
        }
      }
      this.logger.debug(`Change status for ${paymentId} on ${paymentStatus}. IsPaid: ${isPaid}`);
      await this.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, isPaid);
    } else {
      if (paymentStatus !== payment.status) {
        this.logger.debug(`Change status for ${paymentId} on ${paymentStatus}, IsPaid: ${isPaid}`);
        await this.updatePaymentStatus(paymentId, paymentStatus, isPaid);
      }
    }

    return isPaid;
}
  async getPaymentForm(paymentId: string): Promise<string> {
    const payment = await this.prisma.payment.findUnique({where: {paymentId: paymentId}})
    if (!payment) throw new Error(`Payment with id ${paymentId} not found`);

    return payment.form;
  }

  async yooMoneyWebHook({
    operation_id,
    notification_type,
    datetime,
    sha1_hash,
    sender,
    codepro,
    currency,
    amount,
    label,
  }: YooMoneyNotification): Promise<boolean> {
    const secret = this.configService.get('YOOMONEY_SECRET');

    const hashString = [
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      secret,
      label,
    ].join('&');
    const calculatedHash = createHash('sha1').update(hashString).digest('hex');

    if (calculatedHash !== sha1_hash) return false;

    const operationDetails = await this.yooMoney.getOperationDetails(operation_id);
    if (
      operationDetails.operation_id === operation_id &&
      operationDetails.amount === parseFloat(amount) &&
      operationDetails.sender === sender &&
      operationDetails.label === label
    ) {
      await this.updatePaymentStatus(label, PaymentStatusEnum.PAID, true);
      return true;
    }

    return false;
  }
  
}