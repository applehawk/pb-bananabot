import { Module, forwardRef } from '@nestjs/common';
import { FSMService } from './fsm.service';
import { FSMScheduler } from './fsm.scheduler';
import { OverlayService } from './overlay.service';
import { DatabaseModule } from '../../database/database.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        DatabaseModule,
        ScheduleModule.forRoot(),
    ],
    providers: [
        FSMService,
        FSMScheduler,
        OverlayService,
    ],
    exports: [
        FSMService,
        FSMScheduler,
        OverlayService,
    ],
})
export class FSMModule { }
