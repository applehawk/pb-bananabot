import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { GeminiService } from '../gemini/gemini.service';
import { ImageStorageService } from './storage/image-storage.service';
import { GenerationType, GenerationStatus } from '@prisma/client';

export interface GenerateTextToImageParams {
  userId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface GenerateImageToImageParams {
  userId: string;
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
  ) { }

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

    // 2. Calculate cost
    const isBatch = numberOfImages > 1;
    const cost = this.creditsService.calculateCost(
      isBatch ? 'BATCH' : 'TEXT_TO_IMAGE',
      0,
      numberOfImages,
    );

    // 3. Check credits
    if (user.credits < cost) {
      throw new Error(
        `Insufficient credits. Required: ${cost}, Available: ${user.credits}`,
      );
    }

    // 4. Create generation record
    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type: isBatch ? 'BATCH' : 'TEXT_TO_IMAGE',
        prompt,
        negativePrompt:
          negativePrompt || settings.useNegativePrompt
            ? 'blurry, low quality, distorted'
            : null,
        aspectRatio: aspectRatio || settings.aspectRatio,
        numberOfImages,
        safetyLevel: settings.safetyLevel,
        status: 'PROCESSING',
        creditsUsed: cost,
      },
    });

    this.logger.log(`Generation ${generation.id} started for user ${userId}`);

    try {
      // 5. Generate image via Gemini
      const result = isBatch
        ? await this.geminiService.generateBatch({
          prompt,
          negativePrompt: generation.negativePrompt,
          aspectRatio: generation.aspectRatio,
          numberOfImages,
          modelName: settings.geminiModelId,
        })
        : await this.geminiService.generateFromText({
          prompt,
          negativePrompt: generation.negativePrompt,
          aspectRatio: generation.aspectRatio,
          modelName: settings.geminiModelId,
        });

      // 6. Upload to storage
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

      // 7. Deduct credits
      await this.creditsService.deductCredits(userId, cost, generation.id, {
        type: generation.type,
        prompt: prompt.substring(0, 100),
      });

      // 8. Update generation record
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
          metadata: {
            geminiResponse: result.images.length > 1 ? 'batch' : 'single',
            storageConfigured: this.imageStorage.isConfigured(),
          },
        },
      });

      this.logger.log(
        `Generation ${generation.id} completed in ${processingTime}ms`,
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

    // 2. Calculate cost based on number of input images
    const numInputImages = inputImages.length;
    const generationType: GenerationType =
      numInputImages > 1 ? 'MULTI_IMAGE' : 'IMAGE_TO_IMAGE';
    const cost = this.creditsService.calculateCost(
      generationType,
      numInputImages,
      1,
    );

    // 3. Check credits
    if (user.credits < cost) {
      throw new Error(
        `Insufficient credits. Required: ${cost}, Available: ${user.credits}`,
      );
    }

    // 4. Create generation record
    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type: generationType,
        prompt,
        negativePrompt: negativePrompt || null,
        aspectRatio: aspectRatio || settings.aspectRatio,
        numberOfImages: 1,
        safetyLevel: settings.safetyLevel,
        status: 'PROCESSING',
        creditsUsed: cost,
      },
    });

    try {
      // 5. Save input images to database
      for (let i = 0; i < inputImages.length; i++) {
        await this.prisma.inputImage.create({
          data: {
            generationId: generation.id,
            fileId: inputImages[i].fileId ?? null,
            order: i,
          },
        });

        if (!inputImages[i].fileId) {
          this.logger.warn(
            `Input image #${i} for generation ${generation.id} has no telegram fileId; regeneration from telegram will not be available.`,
          );
        }
      }

      // 6. Generate via Gemini
      const result = await this.geminiService.generateFromImage({
        prompt,
        negativePrompt: generation.negativePrompt,
        aspectRatio: generation.aspectRatio,
        inputImages: inputImages.map((img) => ({
          data: img.buffer,
          mimeType: img.mimeType,
        })),
        modelName: settings.geminiModelId,
      });

      // 7. Upload result
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

      // 8. Deduct credits
      await this.creditsService.deductCredits(userId, cost, generation.id, {
        type: generation.type,
        inputImagesCount: numInputImages,
      });

      // 9. Update generation
      const processingTime = Date.now() - startTime;

      const completed = await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'COMPLETED',
          imageUrl,
          thumbnailUrl,
          processingTime,
          completedAt: new Date(),
          metadata: {
            inputImagesCount: numInputImages,
          },
        },
      });

      this.logger.log(
        `Image-to-Image generation ${generation.id} completed in ${processingTime}ms`,
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
}
