import { Module, Global, forwardRef } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { BotService } from './bot.service';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';

/**
 * GrammY Integration Module
 *
 * Provides global access to the GrammY Bot instance throughout the application.
 * Supports both polling (for development) and webhook (for production) modes.
 */
@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [GrammYService, BotService],
  controllers: [WebhookController],
  exports: [GrammYService, BotService],
})
export class GrammYModule {}