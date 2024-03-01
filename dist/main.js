"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const bot_module_1 = require("./bot.module");
const common_1 = require("@nestjs/common");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
async function bootstrap() {
    const app = await core_1.NestFactory.create(bot_module_1.BotModule);
    app.enableCors({ origin: "*", allowedHeaders: "*", methods: "*", credentials: true });
    const port = process.env.PORT || 80;
    await app.listen(port);
    common_1.Logger.log(`Server running on port ${port}`, 'Bootstrap');
}
bootstrap();
//# sourceMappingURL=main.js.map