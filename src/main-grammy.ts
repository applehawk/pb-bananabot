import { NestFactory } from '@nestjs/core';
import { BotModule } from './grammy/bot.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const isDev = process.env.NODE_ENV !== 'production';

  // Development only: Disable TLS verification for local testing
  // WARNING: Never use in production!
  if (isDev && process.env.DISABLE_TLS_VERIFY === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    Logger.warn('⚠️  TLS certificate verification is DISABLED (development only)', 'Security');
  }

  const app = await NestFactory.create(BotModule);

  // Enable CORS with security-conscious defaults
  app.enableCors({
    origin: isDev ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
  });

  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(`🚀 BananaBot (grammY) running on port ${port}`, 'Bootstrap');
  Logger.log(`📡 Mode: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');

  // Debug: Check if providers are initialized
  Logger.log('Checking provider initialization...', 'Bootstrap');
}

bootstrap();
