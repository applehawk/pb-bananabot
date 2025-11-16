import { Module, forwardRef } from '@nestjs/common';
import { GrammYModule } from '../grammy/grammy.module';
import { ConversationsRegistryService } from './conversations-registry.service';

@Module({
  imports: [forwardRef(() => GrammYModule)],
  providers: [ConversationsRegistryService],
  exports: [ConversationsRegistryService],
})
export class ConversationsModule {}
