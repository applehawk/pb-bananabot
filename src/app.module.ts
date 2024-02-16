import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OutlineBackendController } from './outline-backend/outline-backend.controller';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './prisma/prisma.module';
import { ConnectionService } from './prisma/connection.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    PrismaModule
  ],
  controllers: [AppController, OutlineBackendController],
  providers: [AppService, ConnectionService],
})
export class AppModule {}
