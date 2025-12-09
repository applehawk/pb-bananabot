import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageStorageService } from './storage/image-storage.service';
import { GenerationType, GenerationStatus, ModelTariff } from '@prisma/client';

export interface GenerateTextToImageParams {
  userId: string;
  generationId: string; // Added
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface GenerateImageToImageParams {
  userId: string;
  generationId: string; // Added
  prompt: string;
  inputImages: Array<{ buffer: Buffer; mimeType: string; fileId?: string }>;
  negativePrompt?: string;
  aspectRatio?: string;
}

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly geminiService: GeminiService,
    private readonly imageStorage: ImageStorageService,
    @InjectQueue('generation') private readonly generationQueue: Queue,
  ) { }

  async queueGeneration(data: {
    userId: string;
    chatId: number;
    prompt: string;
    mode: 'TEXT_TO_IMAGE' | 'IMAGE_TO_IMAGE';
    inputImages?: Array<{ buffer: Buffer; mimeType: string; fileId?: string }>;
    aspectRatio?: string;
    modelName?: string;
  }) {
    const { userId, prompt, mode, aspectRatio, inputImages, modelName } = data;

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
        negativePrompt: settings.useNegativePrompt ? 'blurry, low quality, distorted' : null,
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
    const {
      userId,
      prompt,
      negativePrompt,
      aspectRatio,
      numberOfImages = 1,
    } = params;

    const startTime = Date.now();

    // 1. Get user settings
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const settings = await this.userService.getSettings(userId);

    // 2. Get Model Tariff
    const modelId = settings.selectedModelId;
    const modelTariff = await this.creditsService.getCachedModelTariff(modelId);

    if (!modelTariff) {
      throw new Error(`Model tariff not found: ${modelId}`);
    }

    // 3. Estimate cost (Pre-check)
    const isBatch = numberOfImages > 1;

    const { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens } = this.calculateEstimatedTokens(modelTariff, settings, {
      mode: 'text',
      numberOfImages,
    });

    const estimatedCost = await this.creditsService.calculateTokenCost(
      modelId,
      estimatedInputTokens,
      estimatedOutputTokens,
      userId
    );

    // 4. Reserve credits before starting generation
    const reservedAmount = estimatedCost.creditsToDeduct;
    await this.creditsService.reserveCredits(userId, reservedAmount);

    // 5. Update generation record to PROCESSING
    // We reuse the existing generation ID created in queue
    const generation = await this.prisma.generation.update({
      where: { id: params.generationId },
      data: {
        status: 'PROCESSING',
        // Update these just in case they changed or were not fully set
        type: isBatch ? 'BATCH' : 'TEXT_TO_IMAGE',
        negativePrompt: negativePrompt || settings.useNegativePrompt ? 'blurry, low quality, distorted' : null,
        numberOfImages,
        creditsUsed: 0,
      },
    });

    this.logger.log(`Generation ${generation.id} started for user ${userId} (reserved: ${reservedAmount} credits)`);

    try {
      // 6. Generate image via Gemini
      const result = isBatch
        ? await this.geminiService.generateBatch({
          prompt,
          negativePrompt: generation.negativePrompt,
          aspectRatio: generation.aspectRatio,
          numberOfImages,
          modelName: settings.selectedModelId,
        })
        : await this.geminiService.generateFromText({
          prompt,
          negativePrompt: generation.negativePrompt,
          aspectRatio: generation.aspectRatio,
          modelName: settings.selectedModelId,
        });

      // 7. Upload to storage
      let imageUrl: string;
      let thumbnailUrl: string;

      if (this.imageStorage.isConfigured()) {
        const imageBuffer = Buffer.from(result.images[0].data, 'base64');
        imageUrl = await this.imageStorage.uploadImage(
          imageBuffer,
          generation.id,
        );
        thumbnailUrl = await this.imageStorage.createThumbnail(
          imageBuffer,
          generation.id,
        );
      } else {
        // Fallback: store base64 in metadata
        this.logger.warn('Image storage not configured, using base64 fallback');
        imageUrl = null;
      }

      // 8. Calculate Final Cost
      // TODO: Get actual token usage from Gemini response if available.
      // For now, use tariff defaults based on resolution/model.
      // Assuming result might have usageMetadata in future.

      const inputTokens = estimatedInputTokens;
      const outputTokens = estimatedOutputTokens; // Use estimated as actual for now since we don't have usage metadata

      const finalCost = await this.creditsService.calculateTokenCost(
        modelId,
        inputTokens,
        outputTokens,
        userId
      );

      // 9. Commit credits (release reservation and deduct actual cost)
      await this.creditsService.commitCredits(
        userId,
        reservedAmount,
        finalCost.creditsToDeduct,
        generation.id,
        {
          type: generation.type,
          prompt: prompt.substring(0, 100),
          costDetails: finalCost.details
        }
      );

      // 10. Update generation record
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
          creditsUsed: finalCost.creditsToDeduct,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          totalCostUsd: finalCost.totalCostUsd,
          costDetails: finalCost.details as any, // Cast to any for Json
          metadata: {
            geminiResponse: result.images.length > 1 ? 'batch' : 'single',
            storageConfigured: this.imageStorage.isConfigured(),
          },
        },
      });

      this.logger.log(
        `Generation ${generation.id} completed in ${processingTime}ms. Cost: ${finalCost.creditsToDeduct} credits ($${finalCost.totalCostUsd})`,
      );

      return {
        ...completed,
        imageData: imageUrl ? null : result.images[0].data, // Return base64 only if no storage
      };
    } catch (error) {
      this.logger.error(
        `Generation ${generation.id} failed: ${error.message}`,
        error.stack,
      );

      // Release reserved credits on failure
      await this.creditsService.releaseCredits(userId, reservedAmount);

      // Update status to failed
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Generate image from image + text (Image-to-Image)
   */
  async generateImageToImage(params: GenerateImageToImageParams): Promise<any> {
    const { userId, prompt, inputImages, negativePrompt, aspectRatio } = params;

    const startTime = Date.now();

    // 1. Get user and settings
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const settings = await this.userService.getSettings(userId);

    // 2. Get Model Tariff
    const modelId = settings.selectedModelId;
    const modelTariff = await this.creditsService.getCachedModelTariff(modelId);

    if (!modelTariff) {
      throw new Error(`Model tariff not found: ${modelId}`);
    }

    // 3. Estimate cost based on number of input images
    const numInputImages = inputImages.length;
    const generationType: GenerationType =
      numInputImages > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';

    // Estimate tokens:
    const { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens } = this.calculateEstimatedTokens(modelTariff, settings, {
      mode: 'image',
      numberOfImages: numInputImages,
    });

    const estimatedCost = await this.creditsService.calculateTokenCost(
      modelId,
      estimatedInputTokens,
      estimatedOutputTokens,
      userId
    );

    // 4. Reserve credits
    const reservedAmount = estimatedCost.creditsToDeduct;
    await this.creditsService.reserveCredits(userId, reservedAmount);

    // 5. Update generation record to PROCESSING
    const generation = await this.prisma.generation.update({
      where: { id: params.generationId },
      data: {
        status: 'PROCESSING',
        type: generationType,
        negativePrompt: negativePrompt || null,
        numberOfImages: 1,
        creditsUsed: 0,
      },
    });

    this.logger.log(`Image-to-Image generation ${generation.id} started for user ${userId} (reserved: ${reservedAmount} credits)`);

    try {
      // 6. Save input images to database (Batch Insert)
      if (inputImages.length > 0) {
        await this.prisma.inputImage.createMany({
          data: inputImages.map((img, index) => ({
            generationId: generation.id,
            fileId: img.fileId ?? '', // Handle optional
            order: index,
          })),
        });

        // Log warnings for missing fileIds (optional, skipping for perf in loop)
      }

      // 7. Generate via Gemini
      const result = await this.geminiService.generateFromImage({
        prompt,
        negativePrompt: generation.negativePrompt,
        aspectRatio: generation.aspectRatio,
        inputImages: inputImages.map((img) => ({
          data: img.buffer,
          mimeType: img.mimeType,
        })),
        modelName: settings.selectedModelId,
      });

      // 8. Upload result
      let imageUrl: string;
      let thumbnailUrl: string;

      if (this.imageStorage.isConfigured()) {
        const imageBuffer = Buffer.from(result.images[0].data, 'base64');
        imageUrl = await this.imageStorage.uploadImage(
          imageBuffer,
          generation.id,
        );
        thumbnailUrl = await this.imageStorage.createThumbnail(
          imageBuffer,
          generation.id,
        );
      } else {
        imageUrl = null;
      }

      // 9. Calculate Final Cost
      const inputTokens = estimatedInputTokens; // Approximation
      const outputTokens = estimatedOutputTokens; // Approximation

      const finalCost = await this.creditsService.calculateTokenCost(
        modelId,
        inputTokens,
        outputTokens,
        userId
      );

      // 10. Commit credits (release reservation and deduct actual cost)
      await this.creditsService.commitCredits(
        userId,
        reservedAmount,
        finalCost.creditsToDeduct,
        generation.id,
        {
          type: generation.type,
          inputImagesCount: numInputImages,
          costDetails: finalCost.details
        }
      );

      // 11. Update generation
      const processingTime = Date.now() - startTime;

      const completed = await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          imageUrl,
          thumbnailUrl,
          processingTime,
          completedAt: new Date(),
          creditsUsed: finalCost.creditsToDeduct,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          totalCostUsd: finalCost.totalCostUsd,
          costDetails: finalCost.details as any,
          metadata: {
            inputImagesCount: numInputImages,
          },
        },
      });

      this.logger.log(
        `Image-to-Image generation ${generation.id} completed in ${processingTime}ms. Cost: ${finalCost.creditsToDeduct} credits`,
      );

      return {
        ...completed,
        imageData: imageUrl ? null : result.images[0].data,
      };
    } catch (error) {
      this.logger.error(
        `Image-to-Image generation ${generation.id} failed: ${error.message}`,
        error.stack,
      );

      // Release reserved credits on failure
      await this.creditsService.releaseCredits(userId, reservedAmount);

      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
        },
      });

      throw error;
    }
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
}
