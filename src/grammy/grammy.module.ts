import { Module, Global } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { WebhookController } from './webhook.controller';

/**
 * GrammY Integration Module
 *
 * Provides global access to the GrammY Bot instance throughout the application.
 * Supports both polling (for development) and webhook (for production) modes.
 */
@Global()
@Module({
  providers: [GrammYService],
  controllers: [WebhookController],
  exports: [GrammYService],
})
export class GrammYModule {}