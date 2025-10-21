import { Module, forwardRef } from '@nestjs/common';

import { BotModule } from '../grammy/bot.module';
//import { MongooseModule } from '@nestjs/mongoose';
//import { PaymentScheduler } from './payment.scheduler';
import { PaymentService } from './payment.service';
//import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
//import { TariffModule } from 'src/tariff/tariff.module';
//import { UserModule } from 'src/user/user.module';
import { YooMoneyClientModule } from '@app/yoomoney-client';
import { PaymentController } from './payment.controller';
import { UserService } from 'src/user/user.service';
import { TariffModule } from 'src/tariff/tariff.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { PaymentScheduler } from './payment.scheduler';
@Module({
  imports: [
    UserModule,
    TariffModule,
    PrismaModule,
    YooMoneyClientModule,
    forwardRef(() => BotModule),
  ],
  providers: [PaymentService, PaymentStrategyFactory, PaymentScheduler],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
