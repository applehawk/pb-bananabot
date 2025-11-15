import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { GrammYService } from './grammy.service';
import { CreditsService } from '../credits/credits.service';
import { GenerationService } from '../generation/generation.service';

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
      await next();
    });
  }
}
