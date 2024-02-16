import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const https = require("https");
const fs = require("fs");
const process = require("process");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function bootstrap() {

  const httpsOptions = {
    key: fs.readFileSync('./cert/test/localhost.pem'),
    cert: fs.readFileSync('./cert/test/server.pem'),
    passphrase: "1234",
  };

  const app = await NestFactory.create(AppModule, {httpsOptions: httpsOptions});
  await app.listen(3000);
}
bootstrap();
