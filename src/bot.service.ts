import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';
import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { BOT_NAME } from './constants/bot-name.const';
import { ConfigService } from '@nestjs/config';
import { replyOrEdit } from './utils/reply-or-edit';
import { UserService } from './prisma/user.service';
import { PrismaClient } from '@prisma/client';
import { User } from '@prisma/client';

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
    private readonly userService: UserService,
  ) {
    
    Logger.log("constructor BotService")
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  async start(ctx: Context) {
   await replyOrEdit(
      ctx,
      SCENES[CommandEnum.START].navigateText,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].navigateButtons),
    );
  }

  async upsertUser(ctx: Context) {
    const newUser: User = {
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      firstname: ctx.from.first_name,
      lastname: ctx.from.last_name,
      nickname: ctx.from.username,
      connLimit: 1
    }
    this.userService.upsert(newUser)
  }
}
