import { Scene, SceneEnter, Ctx } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Context } from '../interfaces/context.interface';
import { SCENES } from 'src/constants/scenes.const';
import { replyOrEdit } from 'src/utils/reply-or-edit';
import { Markup } from 'telegraf';
import { UserService } from 'src/user/user.service';
import { ConnectionService } from 'src/prisma/connection.service';

@Scene(CommandEnum.STATUS)
export class StatusScene extends AbstractScene {
    constructor(
        private userService: UserService,
        private connService: ConnectionService
    ) { super(); }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        this.logger.log(ctx.scene.session.current);

        const user = await this.userService.user({ userId: ctx.from.id })
        const balance = user.balance.toString()
        const connCount = await this.connService.count()
        const scene = SCENES[CommandEnum.STATUS];
        //await replyOrEdit(ctx, scene.text(balance, connCount), Markup.inlineKeyboard(scene.buttons));
        await ctx.replyWithHTML(scene.text(balance, connCount), Markup.inlineKeyboard(scene.buttons));
    }
}
