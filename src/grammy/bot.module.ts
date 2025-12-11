import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from '../health/health.module';

// Core GrammY
import { GrammYModule } from './grammy.module';
import { BotUpdate } from './bot.update';

// Existing modules
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
// Legacy VPN modules (temporarily disabled for image generation bot)
// import { PaymentModule } from '../payment/payment.module';
// import { TariffModule } from '../tariff/tariff.module';

// Configuration
import configuration from '../config/configuration';

import { BroadcastService } from './broadcast.service';
import { SubscriptionService } from './subscription.service';
import { RetentionModule } from '../retention/retention.module';

/**
 * Bot Module (grammY version)
 *
 * Main application module that bootstraps the grammY-based Telegram bot.
 * Replaces the old Telegraf-based BotModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    GrammYModule,
    DatabaseModule,
    forwardRef(() => UserModule),
    RetentionModule,
    // Legacy VPN modules disabled
    // forwardRef(() => PaymentModule),
    // forwardRef(() => TariffModule),
  ],
  controllers: [],
  providers: [
    BotUpdate,
    BroadcastService,
    SubscriptionService,
  ],
  exports: [],
})
export class BotModule { }
