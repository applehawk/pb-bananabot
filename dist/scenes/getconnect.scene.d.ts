import { Context } from '../interfaces/context.interface';
import { AbstractScene } from '../abstract/abstract.scene';
import { OutlineService } from 'src/outline/outline.service';
import { ConnectionService } from 'src/prisma/connection.service';
export declare class GetConnectScene extends AbstractScene {
    private readonly outlineService;
    private readonly connService;
    constructor(outlineService: OutlineService, connService: ConnectionService);
    onSceneEnter(ctx: Context): Promise<void>;
}
