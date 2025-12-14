import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { ImageStorageService } from './storage/image-storage.service';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CreditsModule } from '../credits/credits.module';
import { GeminiModule } from '../gemini/gemini.module';
import { QueueModule } from '../queue/queue.module';
import { FSMModule } from '../services/fsm/fsm.module';

@Module({
  imports: [DatabaseModule, UserModule, CreditsModule, GeminiModule, QueueModule, FSMModule],
  providers: [GenerationService, ImageStorageService],
  exports: [GenerationService, ImageStorageService],
})
export class GenerationModule { }
