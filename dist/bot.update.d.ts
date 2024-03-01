import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { SceneContext } from 'telegraf/typings/scenes';
import { Context } from './interfaces/context.interface';
import { ConfigService } from '@nestjs/config';
import { UserService } from './prisma/user.service';
export declare class BotUpdate {
    private readonly bot;
    private readonly botService;
    private readonly configService;
    private readonly userService;
    private readonly adminChatId;
    private readonly logger;
    constructor(bot: Telegraf<Context>, botService: BotService, configService: ConfigService, userService: UserService);
    onStart(ctx: Context & {
        update: any;
    }): Promise<void>;
    onAnswer(ctx: SceneContext & {
        update: any;
    }): Promise<void>;
    onMenuHears(ctx: Context & {
        update: any;
    }): Promise<void>;
    onHears(ctx: Context & {
        update: any;
    }): Promise<void>;
    private isAdmin;
}
