import { Scene, Ctx, SceneEnter } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { SCENES } from 'src/constants/scenes.const';
import { replyOrEdit } from 'src/utils/reply-or-edit';
import { Markup } from 'telegraf';
import { OutlineService } from 'src/outline/outline.service';
import { ConnectionService } from 'src/prisma/connection.service';

@Scene(CommandEnum.GET_CONNECT)
export class GetConnectScene extends AbstractScene {
    constructor(private readonly outlineService: OutlineService,
                private readonly connService: ConnectionService) {
        super()
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        const tgid: number = ctx.from.id
        this.logger.log(ctx.scene.session.current);

        const connection = await this.outlineService.createConnection(ctx.from.id, "OpenPNBot")
            .catch( reason => {
                return this.connService.connections({where: {tgid: tgid}})
                .then( connections => connections.reduce((acc, curr) => curr, null) )
            })
        console.log(connection)
        const outlineLink = this.outlineService.getOutlineDynamicLink(connection)

        console.log(outlineLink)
        const scene = SCENES.GET_CONNECT(outlineLink);
        this.sceneReply(ctx, scene)
    }
}
