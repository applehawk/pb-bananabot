import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RulesService } from './rules.service';
import { FSMModule } from '../fsm/fsm.module';

@Module({
    imports: [
        DatabaseModule,
        forwardRef(() => FSMModule), // For OverlayService access
    ],
    providers: [
        RulesService,
    ],
    exports: [
        RulesService,
    ],
})
export class RulesModule { }
