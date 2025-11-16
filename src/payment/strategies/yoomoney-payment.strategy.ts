import { YooMoneyClient } from '@app/yoomoney-client';
import { Injectable } from '@nestjs/common';
import { PaymentStatusEnum } from '../enum/payment-status.enum';
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
    const comment = `Payment for ${tariffPrice} credits, userId: ${data.userId}`;
    const paymentId = uuidv4();

    const form = this.yooMoneyClient.generatePaymentForm(
      paymentAmount,
      paymentId,
      comment,
    );

    const payment = new PaymentProxy({
      paymentId,
      form,
      amount: tariffPrice,
      currency: 'RUB',
      status: PaymentStatusEnum.PENDING,
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
