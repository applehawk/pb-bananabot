import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const process = require("process");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function bootstrap() { 
  const app = await NestFactory.create(AppModule);
  await app.init();

  await app.listen(process.env.PORT || 80);
}
bootstrap();
