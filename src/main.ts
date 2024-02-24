import { NestFactory } from '@nestjs/core';
import { BotModule } from './bot.module';
import { Logger } from '@nestjs/common';

async function bootstrap() { 
  const app = await NestFactory.create(BotModule);
  app.enableCors({ origin: "*", allowedHeaders:"*", methods: "*", credentials: true });
  const port = process.env.PORT || 80;
  await app.listen(port);
  Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
bootstrap();
