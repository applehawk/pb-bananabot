import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  TransactionType,
  PaymentMethod,
  TransactionStatus,
} from '@prisma/client';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) { }

  /**
   * Calculate credit cost for generation
   */
  calculateCost(
    type: string,
    numberOfInputImages: number = 0,
    batchSize: number = 1,
  ): number {
    const costs = this.config.get('credits.costs');

    let baseCost = 0;

    switch (type) {
      case 'TEXT_TO_IMAGE':
        baseCost = costs.textToImage;
        break;
      case 'IMAGE_TO_IMAGE':
        baseCost = costs.imageToImage;
        break;
      case 'MULTI_IMAGE':
        baseCost =
          numberOfInputImages <= 4
            ? costs.multiImage2to4
            : costs.multiImage5to16;
        break;
      default:
        baseCost = costs.textToImage;
    }

    // Apply batch multiplier
    if (batchSize > 1) {
      baseCost *= batchSize * costs.batchMultiplier;
    }

    return baseCost;
  }

  /**
   * Add credits to user (purchase)
   */
  async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    paymentMethod: PaymentMethod = 'FREE',
    metadata?: any,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // Update user credits
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          credits: {
            increment: amount,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type,
          creditsAdded: amount,
          paymentMethod,
          status: 'COMPLETED',
          metadata,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Added ${amount} credits to user ${userId} via ${type}`);

      return { user, transaction };
    });
  }

  /**
   * Calculate credit cost for generation based on tokens
   */
  async calculateTokenCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    userId: string,
    options?: { isImageGeneration?: boolean; isHighRes?: boolean; numberOfImages?: number },
  ): Promise<{
    totalCostUsd: number;
    creditsToDeduct: number;
    details: any;
    costRub: number;
  }> {
    // 1. Get Model Tariff
    const model = await this.prisma.modelTariff.findUnique({
      where: { modelId },
    });

    if (!model) {
      throw new Error(`Model tariff not found for ${modelId}`);
    }

    // 2. Get User for personal margin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found ${userId}`);
    }

    // 3. Get System Settings for global margin
    const systemSettings = await this.prisma.systemSettings.findUnique({
      where: { key: 'singleton' },
    });

    // 4. Use shared cost calculator
    const { calculateGenerationCost } = await import('../utils/cost-calculator');

    const result = calculateGenerationCost({
      model,
      systemSettings: {
        systemMargin: systemSettings?.systemMargin || 0,
        creditsPerUsd: systemSettings?.creditsPerUsd || 100,
        usdRubRate: systemSettings?.usdRubRate || 100,
      },
      userMargin: user.personalMargin,
      inputTokens,
      outputTokens,
      isImageGeneration: options?.isImageGeneration ?? model.hasImageGeneration,
      isHighRes: options?.isHighRes,
      numberOfImages: options?.numberOfImages,
    });

    return {
      totalCostUsd: result.totalCostUsd,
      creditsToDeduct: result.creditsToDeduct,
      costRub: result.costRub,
      details: result.details,
    };
  }

  /**
   * Deduct credits from user (generation) - DEPRECATED, use commitCredits instead
   */
  async deductCredits(
    userId: string,
    amount: number,
    generationId: string,
    metadata?: any,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Allow negative balance? No.
      if (user.credits < amount) {
        throw new Error('Insufficient credits');
      }

      // Deduct credits
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          credits: {
            decrement: amount,
          },
          totalGenerated: {
            increment: 1,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'GENERATION_COST',
          creditsAdded: -amount,
          paymentMethod: 'FREE',
          status: 'COMPLETED',
          metadata: {
            ...metadata,
            generationId,
          },
          completedAt: new Date(),
        },
      });

      this.logger.log(`Deducted ${amount} credits from user ${userId}`);

      return { user: updatedUser, transaction };
    });
  }

  /**
   * Reserve credits before generation starts
   * Reserved credits cannot be used for other operations
   */
  async reserveCredits(userId: string, amount: number): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const availableCredits = user.credits - user.reservedCredits;
      if (availableCredits < amount) {
        throw new Error(
          `Insufficient credits. Required: ${amount.toFixed(2)}, Available: ${availableCredits.toFixed(2)}`,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          reservedCredits: {
            increment: amount,
          },
        },
      });

      this.logger.log(`Reserved ${amount} credits for user ${userId}`);
    });
  }

  /**
   * Commit reserved credits after successful generation
   * Releases the reservation and deducts the actual cost
   */
  async commitCredits(
    userId: string,
    reservedAmount: number,
    actualCost: number,
    generationId: string,
    metadata?: any,
  ): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Release reservation and deduct actual cost
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          reservedCredits: {
            decrement: reservedAmount,
          },
          credits: {
            decrement: actualCost,
          },
          totalGenerated: {
            increment: 1,
          },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          type: 'GENERATION_COST',
          creditsAdded: -actualCost,
          paymentMethod: 'FREE',
          status: 'COMPLETED',
          metadata: {
            ...metadata,
            generationId,
            reservedAmount,
          },
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Committed ${actualCost} credits for user ${userId} (reserved: ${reservedAmount})`,
      );

      return { user: updatedUser, transaction };
    });
  }

  /**
   * Release reserved credits (on failed generation)
   */
  async releaseCredits(userId: string, amount: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        reservedCredits: {
          decrement: amount,
        },
      },
    });

    this.logger.log(`Released ${amount} reserved credits for user ${userId}`);
  }

  /**
   * Refund credits (failed generation)
   */
  async refundCredits(userId: string, amount: number, reason: string): Promise<any> {
    return this.addCredits(userId, amount, 'REFUND', 'FREE', { reason });
  }

  /**
   * Grant referral bonus
   */
  async grantReferralBonus(referrerId: string, referredId: string) {
    const bonusReferrer = this.config.get<number>('referral.bonusReferrer');
    const bonusNewUser = this.config.get<number>('referral.bonusNewUser');

    return this.prisma.$transaction(async (tx) => {
      // Give bonus to referrer
      await tx.user.update({
        where: { id: referrerId },
        data: {
          credits: {
            increment: bonusReferrer,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: referrerId,
          type: 'REFERRAL',
          creditsAdded: bonusReferrer,
          paymentMethod: 'FREE',
          status: 'COMPLETED',
          description: `Referral bonus for inviting user`,
          completedAt: new Date(),
        },
      });

      // Give bonus to new user
      await tx.user.update({
        where: { id: referredId },
        data: {
          credits: {
            increment: bonusNewUser,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: referredId,
          type: 'BONUS',
          creditsAdded: bonusNewUser,
          paymentMethod: 'FREE',
          status: 'COMPLETED',
          description: `Welcome bonus for using referral code`,
          completedAt: new Date(),
        },
      });

      // Create referral record
      await tx.referral.create({
        data: {
          referrerId,
          referredId,
          bonusGranted: true,
          bonusAmount: bonusReferrer,
        },
      });

      this.logger.log(`Referral bonus granted: ${referrerId} -> ${referredId}`);
    });
  }

  /**
   * Claim daily bonus
   */
  async claimDailyBonus(userId: string) {
    const dailyBonus = await this.prisma.dailyBonus.findUnique({
      where: { userId },
    });

    const now = new Date();
    const bonuses = this.config.get('dailyBonus');

    let streakDays = 0;
    let bonusAmount = bonuses.day1;

    if (dailyBonus) {
      const lastClaim = dailyBonus.lastClaimDate;
      const daysSinceLastClaim = lastClaim
        ? Math.floor(
          (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24),
        )
        : 999;

      if (daysSinceLastClaim < 1) {
        throw new Error('Daily bonus already claimed today');
      }

      // Continue streak if claimed yesterday
      streakDays = daysSinceLastClaim === 1 ? dailyBonus.streakDays + 1 : 1;
    } else {
      streakDays = 1;
    }

    // Calculate bonus based on streak
    if (streakDays >= 30) bonusAmount = bonuses.day30;
    else if (streakDays >= 7) bonusAmount = bonuses.day7;
    else if (streakDays >= 3) bonusAmount = bonuses.day3;
    else bonusAmount = bonuses.day1;

    return this.prisma.$transaction(async (tx) => {
      // Update or create daily bonus record
      await tx.dailyBonus.upsert({
        where: { userId },
        create: {
          userId,
          streakDays,
          lastClaimDate: now,
          totalBonuses: bonusAmount,
        },
        update: {
          streakDays,
          lastClaimDate: now,
          totalBonuses: {
            increment: bonusAmount,
          },
        },
      });

      // Add credits
      await this.addCredits(userId, bonusAmount, 'DAILY_BONUS', 'FREE', {
        streakDays,
      });

      return { bonusAmount, streakDays };
    });
  }

  /**
   * Get user transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 20): Promise<any[]> {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Estimate cost for image generation (for UI display)
   */
  async estimateImageGenCost(
    userId: string,
    modelId: string,
    isHighRes: boolean = false,
  ): Promise<number> {
    // 1. Get Model Tariff
    const model = await this.prisma.modelTariff.findUnique({
      where: { modelId },
    });

    if (!model) {
      this.logger.warn(`Model tariff not found for ${modelId} during estimation`);
      return 0;
    }

    // 2. Estimate tokens
    const { estimateImageTokens } = await import('../utils/cost-calculator');
    const { inputTokens, outputTokens } = estimateImageTokens(model, isHighRes, 0);

    // 3. Calculate cost
    const { costRub } = await this.calculateTokenCost(
      modelId,
      inputTokens,
      outputTokens,
      userId,
      { isImageGeneration: true, isHighRes },
    );

    return costRub;
  }
}
