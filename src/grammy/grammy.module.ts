import { Module, Global, forwardRef } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { BotService } from './bot.service';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';
import { TariffModule } from '../tariff/tariff.module';
import { PaymentModule } from '../payment/payment.module';
import { CreditsModule } from '../credits/credits.module';
import { GenerationModule } from '../generation/generation.module';
import { ImageGenUpdate } from './image-gen.update';
import { GrammYServiceExtension } from './grammy-service-extension';

/**
 * GrammY Integration Module
 *
 * Provides global access to the GrammY Bot instance throughout the application.
 * Supports both polling (for development) and webhook (for production) modes.
 * Extended with image generation capabilities.
 */
@Global()
@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => TariffModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => CreditsModule),
    forwardRef(() => GenerationModule),
  ],
  providers: [
    GrammYService,
    BotService,
    GrammYServiceExtension,
    ImageGenUpdate,
  ],
  controllers: [WebhookController],
  exports: [GrammYService, BotService],
})
export class GrammYModule {}
