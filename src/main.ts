import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const https = require("https");
const fs = require("fs");
const process = require("process");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function bootstrap() {

  const httpsOptions = {
    rejectUnauthorized: false,
  };
 
  const app = await NestFactory.create(AppModule, { httpsOptions } );
  await app.listen(80);

}
bootstrap();
