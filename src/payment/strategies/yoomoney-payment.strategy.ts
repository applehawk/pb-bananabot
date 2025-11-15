import { YooMoneyClient } from '@app/yoomoney-client';
import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { PaymentSystemEnum } from '../enum/payment-system.enum';
import { Payment } from '@prisma/client';
import {
  PaymentStrategy,
  CreatePaymentData,
  PaymentProxy,
} from './payment-strategy.interface';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

//https://yoomoney.ru/transfer/myservices/http-notification?lang=ru
//https://yoomoney.ru/settings/oauth-services

@Injectable()
export class YooMoneyPaymentStrategy implements PaymentStrategy {
  constructor(
    private readonly yooMoneyClient: YooMoneyClient,
    private readonly configService: ConfigService,
  ) {}

  async createPayment({
    tariffPrice,
    ...data
  }: CreatePaymentData): Promise<PaymentProxy> {
    const paymentAmount = tariffPrice;
    const comment = `Payment for ${tariffPrice} tariff price, userId: ${data.userId}, chatId: ${data.chatId}`;
    const paymentId = uuidv4();
    const orderId = uuidv4();

    const form = this.yooMoneyClient.generatePaymentForm(
      paymentAmount,
      paymentId,
      comment,
    );
    const url = `${this.configService.get('DOMAIN')}/payment/${paymentId}`;

    const payment = new PaymentProxy({
      ...data,
      paymentId,
      orderId,
      amount: tariffPrice,
      paymentSystem: PaymentSystemEnum.YOOMONEY,
      paymentAmount,
      paymentCurrency: 'RUB',
      url,
      form,
      //monthCount: paymentMonths,
    });

    return payment;
  }

  async validateTransaction(paymentId: string): Promise<PaymentStatusEnum> {
    try {
      const { operations } = await this.yooMoneyClient.getOperationHistory({
        label: paymentId,
      });
      if (!operations.length) return PaymentStatusEnum.PENDING;

      const { status } = operations[0];

      if (status === 'success') {
        return PaymentStatusEnum.PAID;
      }
      return PaymentStatusEnum.PENDING;
    } catch (error) {
      return PaymentStatusEnum.FAILED;
    }
  }
}
