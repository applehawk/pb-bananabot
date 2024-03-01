import { Scene, SceneEnter, Ctx } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';
import { replyOrEdit } from 'src/utils/reply-or-edit';
import { SCENES } from 'src/constants/scenes.const';
import { UserService } from 'src/prisma/user.service';

@Scene(CommandEnum.START)
export class StartScene extends AbstractScene {/*
    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        this.logger.log(ctx.scene.session.current);

        const scene = SCENES[ctx.scene.session.current];
        await replyOrEdit(ctx, scene.text, Markup.inlineKeyboard(scene.buttons));
    }    */
}
