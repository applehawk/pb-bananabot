import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

// Core GrammY
import { GrammYModule } from './grammy.module';
import { GrammYService } from './grammy.service';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { ConversationsRegistryService } from './conversations/conversations-registry.service';

// Existing modules
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { UserModule } from '../user/user.module';
import { TariffModule } from '../tariff/tariff.module';

// Services
import { UserService } from '../user/user.service';

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
    HttpModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => UserModule),
    forwardRef(() => TariffModule),
  ],
  controllers: [],
  providers: [
    GrammYService,
    BotService,
    BotUpdate,
    ConversationsRegistryService,
    UserService,
  ],
  exports: [BotService, GrammYService],
})
export class BotModule {}