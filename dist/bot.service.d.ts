import { Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';
import { ConfigService } from '@nestjs/config';
import { UserService } from './prisma/user.service';
export declare class BotService {
    private readonly bot;
    private readonly configService;
    private readonly userService;
    private readonly chatId;
    private readonly adminChatId;
    private readonly isProd;
    private readonly logger;
    constructor(bot: Telegraf<Context>, configService: ConfigService, userService: UserService);
    start(ctx: Context): Promise<void>;
    upsertUser(ctx: Context): Promise<void>;
}
