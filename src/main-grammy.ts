import { NestFactory } from '@nestjs/core';
import { BotModule } from './grammy/bot.module';
import { Logger } from '@nestjs/common';

// SECURITY WARNING: TLS verification is disabled
// This should be fixed in production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function bootstrap() {
  const app = await NestFactory.create(BotModule);

  // SECURITY WARNING: CORS is wide open
  // Should be restricted to specific domains in production
  app.enableCors({
    origin: '*',
    allowedHeaders: '*',
    methods: '*',
    credentials: true,
  });

  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(`🚀 BananaBot (grammY) running on port ${port}`, 'Bootstrap');
  Logger.log(`📡 Mode: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');
}

bootstrap();
