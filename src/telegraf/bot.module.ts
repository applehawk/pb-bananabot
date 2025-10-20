import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionFilter } from '../filters/all-exception.filter';
import { BOT_NAME } from './constants/bot-name.const';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectionService } from '../prisma/connection.service';
import { UserService } from '../user/user.service';
import { Start, TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StartScene } from './scenes/start.scene';
import { commandArgs } from './middlewares/command-args.middleware';
import { session } from 'telegraf';
import { HomeScene } from './scenes/home.scene';
import { QuestionScene } from './scenes/question.scene';
import { OutlineController } from '../outline/outline.controller';
import { OutlineService } from '../outline/outline.service';
import { PaymentScene } from './scenes/payment.scene';
import { ConnectScene } from './scenes/connect.scene';
import { StatusScene } from './scenes/status.scene';
import { PaymentModule } from '../payment/payment.module';
import { UserModule } from '../user/user.module';
import { GetAccessScene } from './scenes/get-access.scene';
import { TariffModule } from '../tariff/tariff.module';
import { MonthTariffScene } from './scenes/month-tariff.scene';
import { ThreeMonthTariffScene } from './scenes/threemonth-tariff.scene';
import { SixMonthTariffScene } from './scenes/sixmonth-tariff.scene';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegrafModule.forRootAsync({
      botName: BOT_NAME,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: process.env.BOT_TOKEN,
        middlewares: [session(), commandArgs()],
        include: [BotModule],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HttpModule,
    PaymentModule,
    UserModule,
    TariffModule
  ],
  controllers: [
    BotController,
    OutlineController
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    BotService,
    ConnectionService,
    BotUpdate,
    StartScene,
    HomeScene,
    GetAccessScene,
    PaymentScene,
    ConnectScene,
    QuestionScene,
    StatusScene,
    ConnectionService, 
    MonthTariffScene,
    ThreeMonthTariffScene,
    SixMonthTariffScene,
    UserService, OutlineService,
  ],
  exports: [BotService],
})
export class BotModule {}
