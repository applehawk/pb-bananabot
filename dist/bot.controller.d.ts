import { BotService } from './bot.service';
export declare class BotController {
    private readonly botService;
    constructor(botService: BotService);
    ping(): string;
}
