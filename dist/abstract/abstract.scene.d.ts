import { Context } from '../interfaces/context.interface';
import { Logger } from '@nestjs/common';
export declare class AbstractScene {
    logger: Logger;
    sceneReply(ctx: Context, scene: any): Promise<void>;
    onSceneEnter(ctx: Context): Promise<void>;
    onSceneLeave(ctx: Context): Promise<void>;
}
