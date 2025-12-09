import { Module, forwardRef } from '@nestjs/common';

import { BotModule } from '../grammy/bot.module';
import { PaymentService } from './payment.service';
import { YooMoneyClientModule } from '@app/yoomoney-client';
import { PaymentController } from './payment.controller';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CreditsModule } from '../credits/credits.module';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { PaymentScheduler } from './payment.scheduler';

@Module({
  imports: [
    UserModule,
    CreditsModule,
    DatabaseModule,
    YooMoneyClientModule,
    forwardRef(() => BotModule),
  ],
  providers: [
    PaymentService,
    PaymentStrategyFactory,
    PaymentScheduler,
  ],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule { }
