import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Core GrammY
import { GrammYModule } from './grammy.module';
import { BotUpdate } from './bot.update';
import { ConversationsRegistryService } from './conversations/conversations-registry.service';

// Existing modules
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { UserModule } from '../user/user.module';
import { TariffModule } from '../tariff/tariff.module';

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
    }),
    ScheduleModule.forRoot(),
    GrammYModule,
    PrismaModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => UserModule),
    forwardRef(() => TariffModule),
  ],
  controllers: [],
  providers: [
    BotUpdate,
    ConversationsRegistryService,
  ],
  exports: [],
})
export class BotModule {}