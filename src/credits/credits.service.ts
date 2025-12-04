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
   * Deduct credits from user (generation)
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
}
