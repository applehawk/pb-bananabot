import { Module, Global, forwardRef } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { BotService } from './bot.service';
import { WebhookController } from './webhook.controller';
import { UserModule } from '../user/user.module';
// Legacy VPN modules (disabled)
// import { TariffModule } from '../tariff/tariff.module';
import { PaymentModule } from '../payment/payment.module';
import { CreditsModule } from '../credits/credits.module';
import { GenerationModule } from '../generation/generation.module';
import { ImageGenModule } from './image-gen.module';
import { GrammYServiceExtension } from './grammy-service-extension';
import { FSMModule } from '../services/fsm/fsm.module';

/**
 * GrammY Integration Module
 *
 * Provides global access to the GrammY Bot instance throughout the application.
 * Supports both polling (for development) and webhook (for production) modes.
 *
 * Module initialization order:
 * 1. ImageGenModule imports ConversationsModule
 *    - ConversationsRegistryService.onModuleInit() registers conversations
 *    - ImageGenService.onModuleInit() registers commands using those conversations
 * 2. BotUpdate.onModuleInit() registers base commands
 * 3. BotUpdate.onApplicationBootstrap() starts the bot
 */
@Global()
@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => CreditsModule),
    forwardRef(() => GenerationModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => FSMModule),
    ImageGenModule, // Handles image generation commands (imports ConversationsModule internally)
  ],
  providers: [
    GrammYService,
    BotService,
    GrammYServiceExtension,
  ],
  controllers: [WebhookController],
  exports: [GrammYService, BotService, GrammYServiceExtension],
})
export class GrammYModule { }
