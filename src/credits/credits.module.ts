import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { BurnableBonusService } from './burnable-bonus.service';
import { DatabaseModule } from '../database/database.module';
import { FSMModule } from '../services/fsm/fsm.module';

@Module({
  imports: [DatabaseModule, FSMModule],
  providers: [CreditsService, BurnableBonusService],
  exports: [CreditsService, BurnableBonusService],
})
export class CreditsModule { }
