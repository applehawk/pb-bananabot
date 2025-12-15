import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule'; // Added imports
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { BurnableBonusService } from '../credits/burnable-bonus.service';
import { GeminiService } from '../gemini/gemini.service';
//import { ImageStorageService } from './storage/image-storage.service';
import { GenerationType, GenerationStatus, ModelTariff } from '@prisma/client';
import { FSMService } from '../services/fsm/fsm.service';
import { FSMEvent } from '../services/fsm/fsm.types';

export interface GenerateTextToImageParams {
  userId: string;
  generationId: string; // Added
  prompt: string;
  // negativePrompt removed
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface GenerateImageToImageParams {
  userId: string;
  generationId: string; // Added
  prompt: string;
  inputImages: Array<{ buffer: Buffer; mimeType: string; fileId?: string }>;
  // negativePrompt removed
  aspectRatio?: string;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly burnableBonusService: BurnableBonusService,
    private readonly geminiService: GeminiService,
    //    private readonly imageStorage: ImageStorageService,
    @InjectQueue('generation') private readonly generationQueue: Queue,
    private readonly fsmService: FSMService,
  ) { }

  async queueGeneration(data: {
    userId: string;
    chatId: number;
    prompt: string;
    mode: 'TEXT_TO_IMAGE' | 'IMAGE_TO_IMAGE';
    inputImages?: Array<{ buffer: Buffer; mimeType: string; fileId?: string }>;
    aspectRatio?: string;
    modelName?: string;
    username?: string; // Added optional username
  }) {
    const { userId, prompt, mode, aspectRatio, inputImages, modelName, username } = data;

    // 1. Get settings to ensure we have correct model/params
    const settings = await this.userService.getSettings(userId);
    const finalModelId = modelName || settings.selectedModelId;
    const finalAspectRatio = aspectRatio || settings.aspectRatio;

    // 2. Create Generation Record (PENDING)
    const generationType = mode === 'TEXT_TO_IMAGE'
      ? 'TEXT_TO_IMAGE'
      : (inputImages && inputImages.length > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE');

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type: generationType,
        prompt,
        negativePrompt: null, // Legacy field, always null now
        aspectRatio: finalAspectRatio,
        numberOfImages: 1, // Default, will be updated if batch works differently later
        safetyLevel: settings.safetyLevel,
        status: 'PENDING', // Initial status
        creditsUsed: 0,
        modelId: finalModelId,
      },
    });

    // 3. Add job to queue with generationId
    const job = await this.generationQueue.add('generate-image', {
      ...data,
      generationId: generation.id
    }, {
      removeOnComplete: true,
      removeOnFail: 100,
    });

    this.logger.log(`Queued generation job ${job.id} (GenID: ${generation.id}) for user ${userId}`);

    // FSM Trigger: GENERATION_PENDING
    this.fsmService.trigger(userId, FSMEvent.GENERATION_PENDING, {
      generationId: generation.id,
      modelId: finalModelId
    }).catch(e => this.logger.warn(`Failed to trigger GENERATION_PENDING: ${e.message}`));

    return { job, generationId: generation.id };
  }

  /**
   * Estimate cost for generation
   */
  async estimateCost(
    userId: string,
    params: {
      mode: 'text' | 'image';
      numberOfImages: number;
    }
  ): Promise<number> {
    const { mode, numberOfImages } = params;

    // 1. Get user settings
    const settings = await this.userService.getSettings(userId);
    const modelId = settings?.selectedModelId || 'gemini-2.5-flash-image'; // Fallback default

    // 2. Get Model Tariff
    const modelTariff = await this.creditsService.getCachedModelTariff(modelId);

    if (!modelTariff) {
      // Return a safe default or 0 if pricing is broken, to avoid blocking UI
      this.logger.warn(`Model tariff not found for estimation: ${modelId}`);
      return 0;
    }

    // 3. Estimate tokens
    const { inputTokens, outputTokens } = this.calculateEstimatedTokens(modelTariff, settings, {
      mode,
      numberOfImages,
    });

    // 4. Calculate
    const cost = await this.creditsService.calculateTokenCost(
      modelId,
      inputTokens,
      outputTokens,
      userId
    );

    return cost.creditsToDeduct;
  }

  /**
   * Generate image from text (Text-to-Image)
   */
  async generateTextToImage(params: GenerateTextToImageParams): Promise<any> {
    const { userId, prompt, numberOfImages = 1, generationId } = params;
    const startTime = Date.now();

    // 1. Prepare (Validate, Estimate, Reserve, Update DB)
    const { generation, settings, estimatedInputTokens, estimatedOutputTokens, reservedAmount } =
      await this.prepareGeneration(userId, generationId, {
        mode: 'text',
        prompt,
        params,
        numberOfImages,
      });

    try {
      // 2. Execute (Gemini API)
      let finalPrompt = prompt;
      let enhancedPromptText: string | undefined;
      let enhancementCost = 0;

      // Apply Auto Enhance if enabled
      if (settings.autoEnhance) {
        this.logger.log(`Auto-enhancing prompt for user ${userId}`);
        const instruction = settings.enhancementPrompt || undefined; // Use custom prompt if set (or default if null)
        const enhanceModelId = 'gemini-2.5-flash'; // Explicitly define model for enhancement

        try {
          // Pass model explicitly
          enhancedPromptText = await this.geminiService.enhancePrompt(prompt, instruction, enhanceModelId);
          finalPrompt = enhancedPromptText;

          // Calculate Enhancement Cost
          try {
            // Approx tokens: 1 token ~= 4 chars
            const inputToks = Math.ceil(prompt.length / 4) + (instruction ? Math.ceil(instruction.length / 4) : 100);
            const outputToks = Math.ceil(enhancedPromptText.length / 4);

            const costResult = await this.creditsService.calculateTokenCost(
              enhanceModelId,
              inputToks,
              outputToks,
              userId
            );
            enhancementCost = costResult.creditsToDeduct;
            this.logger.log(`Enhancement cost: ${enhancementCost} credits (Model: ${enhanceModelId})`);
          } catch (costErr) {
            this.logger.warn(`Failed to calculate enhancement cost: ${costErr.message}`);
          }

        } catch (e) {
          this.logger.warn(`Enhancement failed, using original prompt: ${e.message}`);
        }
      }

      const isBatch = numberOfImages > 1;
      const result = isBatch
        ? await this.geminiService.generateBatch({
          prompt: finalPrompt,
          // negativePrompt removed
          aspectRatio: generation.aspectRatio,
          numberOfImages,
          modelName: settings.selectedModelId,
        })
        : await this.geminiService.generateFromText({
          prompt: finalPrompt,
          // negativePrompt removed
          aspectRatio: generation.aspectRatio,
          modelName: settings.selectedModelId,
        });

      // If we enhanced it here, override result.enhancedPrompt if needed (or prefer result's)
      // GeminiService.generateFromText usually returns the prompt used.
      // If we passed finalPrompt, it returns it as enhancedPrompt?
      // Actually result.enhancedPrompt in GeminiService is set to fullPrompt (which IS finalPrompt).
      // So result.enhancedPrompt should already cover it.
      // But let's be explicit if we have external enhancement.
      if (enhancedPromptText) {
        result.enhancedPrompt = enhancedPromptText;
      }

      // 3. Finalize (Upload, Cost, Commit, Update DB)
      return this.finalizeGeneration({
        startTime,
        userId,
        generation,
        settings,
        result: {
          images: result.images,
          enhancedPrompt: result.enhancedPrompt,
          metadata: {
            geminiResponse: isBatch ? 'batch' : 'single',
            enhancementCost
          }
        },
        estimatedInputTokens,
        estimatedOutputTokens,
        reservedAmount,
        numberOfImages,
        extraCost: enhancementCost // Pass extra cost
      });

    } catch (error) {
      await this.handleGenerationError(generation.id, userId, reservedAmount, error);
    }
  }

  /**
   * Generate image from image + text (Image-to-Image)
   */
  async generateImageToImage(params: GenerateImageToImageParams): Promise<any> {
    const { userId, prompt, inputImages, generationId } = params;
    const startTime = Date.now();

    // 1. Prepare
    const numInputImages = inputImages.length;
    const { generation, settings, estimatedInputTokens, estimatedOutputTokens, reservedAmount } =
      await this.prepareGeneration(userId, generationId, {
        mode: 'image',
        prompt,
        params,
        numberOfImages: numInputImages,
        inputImages // Pass input images for saving if needed
      });

    try {
      // Save input images to database (Batch Insert)
      if (inputImages.length > 0) {
        await this.prisma.inputImage.createMany({
          data: inputImages.map((img, index) => ({
            generationId: generation.id,
            fileId: img.fileId ?? '',
            order: index,
          })),
        });
      }

      // 1.5 Enhance Prompt (Copied from TextToImage)
      let finalPrompt = prompt;
      let enhancedPromptText: string | undefined;
      let enhancementCost = 0;

      if (settings.autoEnhance) {
        this.logger.log(`Auto-enhancing prompt for user ${userId} (Img2Img)`);
        const instruction = settings.enhancementPrompt || undefined;
        const enhanceModelId = 'gemini-2.5-flash';

        try {
          enhancedPromptText = await this.geminiService.enhancePrompt(prompt, instruction, enhanceModelId);
          finalPrompt = enhancedPromptText;

          // Calculate Cost
          try {
            // Approx tokens: 1 token ~= 4 chars
            const inputToks = Math.ceil(prompt.length / 4) + (instruction ? Math.ceil(instruction.length / 4) : 100);
            const outputToks = Math.ceil(enhancedPromptText.length / 4);

            const costResult = await this.creditsService.calculateTokenCost(
              enhanceModelId,
              inputToks,
              outputToks,
              userId
            );
            enhancementCost = costResult.creditsToDeduct;
            this.logger.log(`Enhancement cost: ${enhancementCost} credits`);
          } catch (costErr) {
            this.logger.warn(`Failed to calculate enhancement cost: ${costErr.message}`);
          }
        } catch (e) {
          this.logger.warn(`Enhancement failed: ${e.message}`);
        }
      }

      // 2. Execute
      const result = await this.geminiService.generateFromImage({
        prompt: finalPrompt,
        // negativePrompt removed
        aspectRatio: generation.aspectRatio,
        inputImages: inputImages.map((img) => ({
          data: img.buffer,
          mimeType: img.mimeType,
        })),
        modelName: settings.selectedModelId,
      });

      // 3. Finalize
      return this.finalizeGeneration({
        startTime,
        userId,
        generation,
        settings,
        result: {
          images: result.images,
          enhancedPrompt: enhancedPromptText,
          metadata: {
            inputImagesCount: numInputImages,
            enhancementCost
          }
        },
        estimatedInputTokens,
        estimatedOutputTokens,
        reservedAmount,
        numberOfImages: 1, // Output is usually 1 for img2img
        extraCost: enhancementCost
      });

    } catch (error) {
      await this.handleGenerationError(generation.id, userId, reservedAmount, error);
    }
  }

  // =================================================================================================
  // HELPER METHODS
  // =================================================================================================

  private async prepareGeneration(
    userId: string,
    generationId: string,
    options: {
      mode: 'text' | 'image';
      prompt: string;
      numberOfImages: number; // For Text: output count. For Image: input count.
      params: any; // Original params for extracting aspectRatio
      inputImages?: any[];
    }
  ) {
    const { mode, prompt, numberOfImages, params, inputImages } = options;

    // 1. Get user & settings
    const user = await this.userService.findById(userId);
    if (!user) throw new Error('User not found');

    const settings = await this.userService.getSettings(userId);
    const modelId = settings.selectedModelId;
    const modelTariff = await this.creditsService.getCachedModelTariff(modelId);

    if (!modelTariff) throw new Error(`Model tariff not found: ${modelId}`);

    // 2. Estimate tokens
    const { inputTokens, outputTokens } = this.calculateEstimatedTokens(modelTariff, settings, {
      mode,
      numberOfImages,
    });

    // 3. Estimate cost & Reserve
    const estimatedCost = await this.creditsService.calculateTokenCost(
      modelId,
      inputTokens,
      outputTokens,
      userId
    );
    const reservedAmount = estimatedCost.creditsToDeduct;
    await this.creditsService.reserveCredits(userId, reservedAmount);

    // 4. Update Generation to PROCESSING
    const isBatch = mode === 'text' && numberOfImages > 1;
    const generationType = mode === 'text'
      ? (isBatch ? 'BATCH' : 'TEXT_TO_IMAGE')
      : (inputImages && inputImages.length > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE');

    const finalAspectRatio = params.aspectRatio || settings.aspectRatio;

    // Original logic: Img2Img didn't use settings.useNegativePrompt fallback
    // Negative Prompt logic removed
    let finalNegativePrompt = null;
    // if (mode === 'text' && !finalNegativePrompt && settings.useNegativePrompt) {
    //   finalNegativePrompt = 'blurry, low quality, distorted';
    // }

    // Original logic: Img2Img saved 1 as numberOfImages (output), but processed multiple inputs
    // We use 'numberOfImages' var for cost calc (which is input count for img2img), 
    // but we should save 1 to DB for img2img.
    const dbNumberOfImages = mode === 'text' ? numberOfImages : 1;

    const generation = await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: 'PROCESSING',
        type: generationType,
        negativePrompt: finalNegativePrompt || null,
        aspectRatio: options.mode === 'text' ? finalAspectRatio : undefined,
        numberOfImages: dbNumberOfImages,
        creditsUsed: 0,
        reservedAmount: reservedAmount,
      },
    });

    this.logger.log(`${generationType} generation ${generation.id} started for user ${userId} (reserved: ${reservedAmount})`);

    return {
      generation,
      settings,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      reservedAmount
    };
  }

  private async finalizeGeneration(params: {
    startTime: number;
    userId: string;
    generation: any;
    settings: any;
    result: { images: any[], enhancedPrompt?: string, metadata?: any };
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    reservedAmount: number;
    numberOfImages: number;
    extraCost?: number; // Added optional extraCost
  }) {
    const {
      startTime, userId, generation, settings, result,
      estimatedInputTokens, estimatedOutputTokens, reservedAmount, numberOfImages,
      extraCost = 0 // Default to 0
    } = params;

    // 1. Upload
    let imageUrl: string;
    let thumbnailUrl: string;

    // if (this.imageStorage.isConfigured()) {
    //   const imageBuffer = Buffer.from(result.images[0].data, 'base64');
    //   imageUrl = await this.imageStorage.uploadImage(imageBuffer, generation.id);
    //   thumbnailUrl = await this.imageStorage.createThumbnail(imageBuffer, generation.id);
    // } else {
    //   this.logger.warn('Image storage not configured, using base64 fallback');
    //   imageUrl = null;
    // }

    // 2. Final Cost
    const modelId = settings.selectedModelId;
    const finalCost = await this.creditsService.calculateTokenCost(
      modelId,
      estimatedInputTokens,
      estimatedOutputTokens,
      userId
    );

    const totalCreditsToDeduct = finalCost.creditsToDeduct + extraCost;

    // 3. Commit Credits
    await this.creditsService.commitCredits(
      userId,
      reservedAmount,
      totalCreditsToDeduct,
      generation.id,
      {
        type: generation.type,
        prompt: generation.prompt.substring(0, 100),
        costDetails: {
          ...finalCost.details,
          extraCost,
          reason: extraCost > 0 ? 'Includes enhancement cost' : undefined
        },
        imagesCount: numberOfImages
      }
    );

    // 4. Bonus
    await this.burnableBonusService.onGeneration(userId);

    // 5. Update DB
    const processingTime = Date.now() - startTime;
    const completed = await this.prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: 'COMPLETED',
        imageUrl,
        thumbnailUrl,
        enhancedPrompt: result.enhancedPrompt,
        processingTime,
        completedAt: new Date(),
        creditsUsed: finalCost.creditsToDeduct + extraCost,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        totalTokens: estimatedInputTokens + estimatedOutputTokens,
        totalCostUsd: finalCost.totalCostUsd,
        costDetails: finalCost.details as any,
        metadata: {
          ...result.metadata,
          //storageConfigured: this.imageStorage.isConfigured(),
        },
      },
    });

    this.logger.log(
      `Generation ${generation.id} completed in ${processingTime}ms. Cost: ${finalCost.creditsToDeduct} credits`,
    );

    // FSM Trigger: GENERATION_COMPLETED
    this.fsmService.trigger(userId, FSMEvent.GENERATION_COMPLETED, {
      generationId: generation.id,
      creditsUsed: finalCost.creditsToDeduct + extraCost
    }).catch(e => this.logger.warn(`Failed to trigger GENERATION_COMPLETED: ${e.message}`));

    // Check for FIRST_GENERATION
    // We fetch user stats to see if this was their first one
    const userStats = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalGenerated: true }
    });

    if (userStats && userStats.totalGenerated === 1) {
      this.fsmService.trigger(userId, FSMEvent.FIRST_GENERATION, {
        generationId: generation.id,
        reason: 'User completed their first generation'
      }).catch(e => this.logger.warn(`Failed to trigger FIRST_GENERATION: ${e.message}`));
    }

    return {
      ...completed,
      imageData: imageUrl ? null : result.images[0].data,
    };
  }

  private async handleGenerationError(
    generationId: string,
    userId: string,
    reservedAmount: number,
    error: any
  ) {
    this.logger.error(`Generation ${generationId} failed: ${error.message}`, error.stack);

    // Release credits
    try {
      await this.creditsService.releaseCredits(userId, reservedAmount);
    } catch (e) {
      this.logger.error(`Failed to release credits for ${generationId}`, e);
    }

    // Update status
    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });

    // FSM Trigger: GENERATION_FAILED
    this.fsmService.trigger(userId, FSMEvent.GENERATION_FAILED, {
      generationId,
      error: error.message
    }).catch(e => this.logger.warn(`FSM Trigger Failed: ${e.message}`));

    throw error;
  }

  /**
   * Get user's generation history
   */
  async getHistory(userId: string, limit: number = 20): Promise<any[]> {
    return this.prisma.generation.findMany({
      where: {
        userId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        inputImages: true,
      },
    });
  }

  /**
   * Get generation by ID
   */
  async getById(id: string): Promise<any> {
    return this.prisma.generation.findUnique({
      where: { id },
      include: {
        inputImages: true,
        user: {
          select: {
            username: true,
            firstName: true,
          },
        },
      },
    });
  }

  /**
   * Cancel generation
   */
  async cancel(id: string, userId: string): Promise<any> {
    const generation = await this.prisma.generation.findFirst({
      where: { id, userId },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    if (generation.status !== 'PROCESSING') {
      throw new Error('Can only cancel processing generations');
    }

    // Refund credits
    await this.creditsService.refundCredits(
      userId,
      generation.creditsUsed,
      'Generation cancelled by user',
    );

    return this.prisma.generation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Cancelled by user',
      },
    });
  }

  /**
   * Get generation statistics
   */
  async getStatistics(userId?: string) {
    const where = userId ? { userId } : {};

    const [total, completed, failed, processing] = await Promise.all([
      this.prisma.generation.count({ where }),
      this.prisma.generation.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      this.prisma.generation.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.generation.count({
        where: { ...where, status: 'PROCESSING' },
      }),
    ]);

    return {
      total,
      completed,
      failed,
      processing,
      successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
    };
  }

  /**
   * Helper: Calculate estimated tokens based on mode and settings
   */
  private calculateEstimatedTokens(
    modelTariff: ModelTariff,
    settings: any,    // UserSettings
    params: { mode: 'text' | 'image'; numberOfImages: number }
  ): { inputTokens: number; outputTokens: number } {
    const { mode, numberOfImages } = params;

    const perImageTokens = settings?.hdQuality
      ? (modelTariff.imageTokensHighRes || 1000)
      : (modelTariff.imageTokensLowRes || modelTariff.imageTokensHighRes || 1000);

    if (mode === 'text') {
      const inputTokens = modelTariff.inputImageTokens || 100;
      const outputTokens = perImageTokens * numberOfImages;
      return { inputTokens, outputTokens };
    } else {
      // Image to Image
      // Input: (Input Image Tokens * Num Input Images) + Prompt Tokens (approx 100)
      const inputTokens = (modelTariff.inputImageTokens || 258) * numberOfImages + 100;
      const outputTokens = perImageTokens; // Always 1 output image for img2img currently
      return { inputTokens, outputTokens };
    }
  }


  /**
   * Cleanup Stuck Generations (Cron Job)
   * Runs every 10 minutes to fail generations stuck in PROCESSING for > 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupStuckGenerations() {
    this.logger.log('Running stuck generation cleanup...');
    const timeoutThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

    const stuckGenerations = await this.prisma.generation.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: {
          lt: timeoutThreshold, // Older than 15 mins
        },
      },
    });

    if (stuckGenerations.length === 0) {
      return;
    }

    this.logger.warn(`Found ${stuckGenerations.length} stuck generations. Cleaning up...`);

    for (const gen of stuckGenerations) {
      try {
        // Calculate estimated cost to release
        let amountToRelease = 0;

        if (gen.reservedAmount && gen.reservedAmount > 0) {
          // Use stored reserved amount if available (NEW LOGIC)
          amountToRelease = gen.reservedAmount;
        } else {
          // Fallback to recalculation (OLD LOGIC)
          try {
            const settings = await this.userService.getSettings(gen.userId);
            const modelId = gen.modelId || settings?.selectedModelId || 'gemini-2.5-flash-image';
            const modelTariff = await this.creditsService.getCachedModelTariff(modelId);

            if (modelTariff) {
              const { inputTokens, outputTokens } = this.calculateEstimatedTokens(modelTariff, settings, {
                mode: gen.type === 'TEXT_TO_IMAGE' ? 'text' : 'image',
                numberOfImages: gen.numberOfImages || 1
              });

              const cost = await this.creditsService.calculateTokenCost(modelId, inputTokens, outputTokens, gen.userId);
              amountToRelease = cost.creditsToDeduct;
            }
          } catch (calcErr) {
            this.logger.warn(`Could not calculate release amount for stuck generation ${gen.id}: ${calcErr.message}. Releasing 0.`);
          }
        }

        // Release reserved credits
        if (amountToRelease > 0) {
          await this.creditsService.releaseCredits(gen.userId, amountToRelease);
        }

        // Set status to FAILED
        await this.prisma.generation.update({
          where: { id: gen.id },
          data: {
            status: 'FAILED',
            errorMessage: 'Timeout: Generation stuck in processing',
          },
        });

        this.logger.log(`Cleaned up stuck generation ${gen.id} for user ${gen.userId}. Released ${amountToRelease}`);

      } catch (err) {
        this.logger.error(`Failed to cleanup generation ${gen.id}`, err);
      }
    }
  }
}
