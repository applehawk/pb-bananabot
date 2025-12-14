import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { DatabaseModule } from '../database/database.module';
import { FSMModule } from '../services/fsm/fsm.module';

@Module({
  imports: [DatabaseModule, FSMModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule { }
