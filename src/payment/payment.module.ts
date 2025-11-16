import { Module, forwardRef } from '@nestjs/common';

import { BotModule } from '../grammy/bot.module';
import { PaymentService } from './payment.service';
import { YooMoneyClientModule } from '@app/yoomoney-client';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/user/user.module';
import { CreditsModule } from 'src/credits/credits.module';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
// Legacy modules disabled
// import { PaymentScheduler } from './payment.scheduler';

@Module({
  imports: [
    UserModule,
    CreditsModule,
    PrismaModule,
    YooMoneyClientModule,
    forwardRef(() => BotModule),
  ],
  providers: [
    PaymentService,
    PaymentStrategyFactory,
    // PaymentScheduler, // Disabled - used VPN subscription logic
  ],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
