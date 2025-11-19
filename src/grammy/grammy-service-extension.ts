import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { conversations } from '@grammyjs/conversations';
import { GrammYService } from './grammy.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';
import { PaymentService } from '../payment/payment.service';

/**
 * Extension для GrammYService
 * Добавляет инъекцию новых сервисов для генерации изображений
 */
@Injectable()
export class GrammYServiceExtension {
  constructor(
    private readonly grammyService: GrammYService,
    @Inject(forwardRef(() => CreditsService))
    private readonly creditsService: CreditsService,
    @Inject(forwardRef(() => GenerationService))
    private readonly generationService: GenerationService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {
    // Расширяем middleware для инъекции новых сервисов
    this.setupImageGenServices();
  }

  private setupImageGenServices(): void {
    const bot = this.grammyService.bot;

    // Добавляем новые сервисы в контекст
    bot.use(async (ctx, next) => {
      ctx.creditsService = this.creditsService;
      ctx.generationService = this.generationService;
      ctx.paymentService = this.paymentService;
      await next();
    });

    // Register conversations middleware HERE
    // This ensures it runs AFTER the service injection middleware above
    bot.use(conversations());
  }
}
