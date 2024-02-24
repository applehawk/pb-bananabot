import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { BOT_NAME } from './constants/bot-name.const';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { OutlineBackendController } from './outline-backend/outline-backend.controller';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './prisma/prisma.module';
import { ConnectionService } from './prisma/connection.service';
import { UserService } from './prisma/user.service';
import { Start, TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StartScene } from './scenes/start.scene';
import { commandArgs } from './middlewares/command-args.middleware';
import { session } from 'telegraf';
import { HomeScene } from './scenes/home.scene';
import { QuestionScene } from './scenes/question.scene';
import { StartConnectScene } from './scenes/startconnect.scene';

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
    PrismaModule,
    HttpModule,
  ],
  controllers: [
    BotController, 
    OutlineBackendController
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    BotService,
    UserService,
    ConnectionService,
    BotUpdate,
    StartScene,
    HomeScene,
    StartConnectScene,
    QuestionScene,
    ConnectionService, 
    UserService,
  ],
  exports: [BotService],
})
export class BotModule {}
