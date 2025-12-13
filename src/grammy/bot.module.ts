import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BotService } from './bot.service';
import { HealthModule } from '../health/health.module';

// Core GrammY
import { GrammYModule } from './grammy.module';
import { BotUpdate } from './bot.update';

// Existing modules
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CreditsModule } from '../credits/credits.module';
// Legacy VPN modules (temporarily disabled for image generation bot)
// import { PaymentModule } from '../payment/payment.module';
// import { TariffModule } from '../tariff/tariff.module';

// Configuration
import configuration from '../config/configuration';

import { BroadcastService } from './broadcast.service';
import { SubscriptionService } from './subscription.service';
import { RetentionModule } from '../retention/retention.module';
import { DebugModule } from '../debug/debug.module';

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
      load: [
        configuration,
        // ... (other configs if any)
      ],
    }),
    ScheduleModule.forRoot(), // Added ScheduleModule
    DatabaseModule,
    CreditsModule,
    UserModule,
    // GenerationModule, // Assuming these are new modules to be added
    // GeminiModule, // Assuming these are new modules to be added
    GrammYModule,
    // QueueModule, // Added Queue Module for BullMQ integration
    HealthModule,
    DebugModule,
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
