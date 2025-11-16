import { Module } from '@nestjs/common';
import { ImageGenService } from './image-gen.service';
import { ConversationsModule } from '../conversations/conversations.module';

/**
 * Image Generation Module
 *
 * Handles image generation commands and workflows.
 * Depends on ConversationsModule for conversation flows.
 *
 * Module dependency chain:
 * ConversationsModule → ImageGenModule
 * ConversationsRegistryService registers conversations,
 * then ImageGenService registers commands that use those conversations.
 */
@Module({
  imports: [
    ConversationsModule, // Required: provides registered conversations
  ],
  providers: [ImageGenService],
  exports: [ImageGenService],
})
export class ImageGenModule {}
