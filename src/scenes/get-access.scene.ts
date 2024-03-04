import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Tariff } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { SCENES } from 'src/constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from 'src/interfaces/context.interface';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';

@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends AbstractScene {
  public logger = new Logger(AbstractScene.name);

  constructor(
    private readonly tariffService: TariffService, 
    private readonly userService: UserService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const tariffs = await this.tariffService.getAllTariffs();
    const scene = SCENES[ctx.scene.session.current];

    const user = await this.userService.findOneByUserId(ctx.from.id);
    try {
      if (!user)
        await this.userService.createUser({
          userId: ctx.from.id,
          chatId: ctx.chat.id,
          username: ctx.from.username,
          connLimit: 1,
          balance: 0.0
        });
      ctx.session.messageId = undefined;
    } catch (e) {
      this.logger.log(e);
    }

    const balance = user.balance.toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    });

    await ctx.replyWithHTML(scene.navigateText, Markup.keyboard(scene.navigateButtons).resize());
    await ctx.replyWithHTML(scene.text(tariffs, balance), Markup.inlineKeyboard(scene.buttons(tariffs)));
  }
}
