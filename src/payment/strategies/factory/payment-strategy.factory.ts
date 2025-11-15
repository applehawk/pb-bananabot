import { Injectable } from '@nestjs/common';
import { PaymentStrategy } from '../payment-strategy.interface';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';

//import { InjectModel } from '@nestjs/mongoose';
//import { Model } from 'mongoose';

import { Payment } from '@prisma/client';
import { YooMoneyPaymentStrategy } from '../yoomoney-payment.strategy';
import { YooMoneyClient } from '@app/yoomoney-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentStrategyFactory {
  constructor(
    private readonly yooMoneyClient: YooMoneyClient,
    private readonly configService: ConfigService,
  ) {}

  createPaymentStrategy(paymentSystem: PaymentSystemEnum): PaymentStrategy {
    switch (paymentSystem) {
      case PaymentSystemEnum.YOOMONEY:
        return new YooMoneyPaymentStrategy(
          this.yooMoneyClient,
          this.configService,
        );
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }
  }
}
