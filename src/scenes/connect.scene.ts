import { Scene, Ctx, SceneEnter } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { SCENES } from 'src/constants/scenes.const';
import { replyOrEdit } from 'src/utils/reply-or-edit';
import { Markup } from 'telegraf';
import { OutlineService } from 'src/outline/outline.service';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/user/user.service';

const MINIMUM_BALANCE = 3.0

@Scene(CommandEnum.CONNECT)
export class ConnectScene extends AbstractScene {
    constructor(private readonly outlineService: OutlineService,
                private readonly connService: ConnectionService,
                private readonly userService: UserService) {
        super()
    }

    @SceneEnter()
    async onSceneEnter(@Ctx() ctx: Context) {
        const userId = ctx.from.id;
        this.logger.log(ctx.scene.session.current);

        const user = await this.userService.findOneByUserId(ctx.from.id);
        if(user.balance <= MINIMUM_BALANCE) {
            ctx.scene.enter(CommandEnum.GET_ACCESS)
            return
        }

        const connection = await this.outlineService.createConnection(userId, "OpenPNBot")
            .catch( reason => {
                return this.connService.connections({where: {userId: userId }})
                .then( connections => connections.reduce((acc, curr) => curr, null) )
            })
        
        const outlineLink = this.outlineService.getOutlineDynamicLink(connection)
        const fastRedirectLink = this.outlineService.getConnectionRedirectLink(connection)

        const scene = SCENES.CONNECT.balancePositive(outlineLink);

        scene.buttons = [
            [Markup.button.url('для iOS 🍏', fastRedirectLink)],
            [Markup.button.url('для Android 🤖', fastRedirectLink)],
        ]
        this.sceneReply(ctx, scene)
    }
}
