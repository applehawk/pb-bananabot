import { Module, forwardRef } from '@nestjs/common';
import { FSMService } from './fsm.service';
import { FSMScheduler } from './fsm.scheduler';
import { OverlayService } from './overlay.service';
import { DatabaseModule } from '../../database/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CreditsModule } from '../../credits/credits.module';
import { RulesModule } from '../rules/rules.module';

@Module({
    imports: [
        DatabaseModule,
        ScheduleModule.forRoot(),
        forwardRef(() => CreditsModule),
        forwardRef(() => RulesModule),
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
