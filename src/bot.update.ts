import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { Action, Command, Ctx, Hears, InjectBot, On, Start, Update, Help } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { SceneContext } from 'telegraf/typings/scenes';
import { BOT_NAME } from './constants/bot-name.const';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { ResponseTimeInterceptor } from './interceptors/response-time-interceptor.service';
import { Context } from './interfaces/context.interface';
import { CommandEnum } from './enum/command.enum';
import { BUTTONS } from './constants/buttons.const';
import { ConfigService } from '@nestjs/config';
import { UserService } from './prisma/user.service';

@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
@Update()
export class BotUpdate {
  private readonly adminChatId: number;

  private readonly logger = new Logger(BotUpdate.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
    private readonly configService: ConfigService,
    private readonly userService: UserService
  ) {
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }

  @Start()
  async onStart(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) {
      await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
        reply_markup: {
          remove_keyboard: true,
        },
      });
      return;
    }
  
    ctx.session.messageId = undefined;
    // we added any user which start communicate with TG Bot
    await this.botService.upsertUser(ctx);

    await ctx.scene.enter(CommandEnum.START);
  }

  @Action(/.*/)
  async onAnswer(@Ctx() ctx: SceneContext & { update: any }) {
    this.logger.log(ctx);
    try {
      const cbQuery = ctx.update.callback_query;
      if (!['private'].includes(cbQuery.message.chat.type)) return;
      const nextStep = 'data' in cbQuery ? cbQuery.data : null;
      await ctx.scene.enter(nextStep);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(BUTTONS[CommandEnum.HOME].text)
  async onMenuHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    try {
      this.logger.log('hears', ctx.message);
      const existUser = await this.userService.findOneByUserId(ctx.from.id);
      if (existUser) {
        ctx.scene.enter(CommandEnum.HOME);
      } else {
        ctx.scene.enter(CommandEnum.START);
      }
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(/.*/)
  async onHears(@Ctx() ctx: Context & { update: any }) {
    this.logger.log("onHears")
    const user = await this.userService.findOneByUserId(ctx.from.id);
    if (user && !user.chatId) await this.userService.updateUser({where: {userId: user.userId}, data: { chatId: ctx.chat.id }});
    
    try {
      const message = ctx.update.message;
      const [command] = Object.entries(BUTTONS).find(([_, button]) => button.text === message.text);

      if (!['private'].includes(message.chat.type)) return;

      this.logger.log('stats', ctx.message);
      ctx.scene.enter(command);
    } catch (e) {
      this.logger.log(e);
    }
  }
  private isAdmin(ctx: Context): boolean {
    return ctx.chat.id === this.adminChatId;
  }

}