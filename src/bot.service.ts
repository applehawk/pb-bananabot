import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';
import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigService } from '@nestjs/config';
import { replyOrEdit } from './utils/reply-or-edit';

@Injectable()
export class BotService {
  private readonly chatId: string;
  private readonly adminChatId: string;
  private readonly isProd: boolean;

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {
    
    Logger.log("constructor BotService")
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  getHello(): string {
    return 'Hello World!';
  }

  async start(ctx: Context) {
   /* await replyOrEdit(
      ctx,
      SCENES[CommandEnum.START].navigateText,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].navigateButtons),
    );*/
  }
}
