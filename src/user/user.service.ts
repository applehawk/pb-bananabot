import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User, UserSettings } from '@prisma/client';
import { nanoid } from 'nanoid';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId: bigint | number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: { settings: true },
    });
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { settings: true },
    });
  }

  /**
   * Find user by referral code
   */
  async findByReferralCode(referralCode: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { referralCode },
    });
  }

  /**
   * Create or update user
   */
  async upsert(data: {
    telegramId: bigint | number;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    referredBy?: string;
  }): Promise<{ user: User; referral?: { referrerTelegramId: bigint; bonusAmount: number } }> {
    const telegramId = BigInt(data.telegramId);

    const existingUser = await this.findByTelegramId(telegramId);

    if (existingUser) {
      const user = await this.prisma.user.update({
        where: { telegramId },
        data: {
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          languageCode: data.languageCode,
          lastActiveAt: new Date(),
        },
        include: { settings: true },
      });
      return { user };
    }

    // Create new user
    const referralCode = nanoid(8);

    // Get settings
    const systemSettings = await this.prisma.systemSettings.findUnique({
      where: { key: 'singleton' },
    });
    const freeCredits = systemSettings?.freeCreditsAmount ?? 3;
    const referralBonus = systemSettings?.referralBonusAmount ?? 50;

    // Handle Referral Logic
    let referrerId: string | undefined;
    let referralInfo: { referrerTelegramId: bigint; bonusAmount: number } | undefined;

    if (data.referredBy) {
      // Find referrer by their Telegram ID (which is passed as referredBy string)
      const referrer = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(data.referredBy) },
      });

      if (referrer) {
        referrerId = referrer.id;

        // Grant bonus credits to referrer
        const bonusAmount = referralBonus;
        await this.prisma.user.update({
          where: { id: referrer.id },
          data: {
            credits: { increment: bonusAmount },
          },
        });

        // Create Transaction for Referrer
        await this.prisma.transaction.create({
          data: {
            userId: referrer.id,
            type: 'REFERRAL',
            creditsAdded: bonusAmount,
            description: `Referral bonus for user ${data.username || data.telegramId}`,
            status: 'COMPLETED',
            isFinal: true,
          },
        });

        if (referrer.telegramId) {
          referralInfo = {
            referrerTelegramId: referrer.telegramId,
            bonusAmount,
          };
        }

        this.logger.log(`Granted ${bonusAmount} referral credits to ${referrer.telegramId}`);
      }
    }

    const user = await this.prisma.user.create({
      data: {
        telegramId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        languageCode: data.languageCode || 'en',
        referralCode,
        referredBy: data.referredBy,
        credits: freeCredits,
        settings: {
          create: {
            aspectRatio: '1:1',
            numberOfImages: 1,
            safetyLevel: 'BLOCK_MEDIUM_AND_ABOVE',
            language: data.languageCode || 'en',
          },
        },
        // Create Referral record if referrer found
        ...(referrerId ? {
          referralsReceived: {
            create: {
              referrerId: referrerId,
              bonusAmount: referralInfo?.bonusAmount ?? 50,
              bonusGranted: true,
            }
          }
        } : {})
      },
      include: { settings: true },
    });

    this.logger.log(
      `New user created: ${user.telegramId}, referral: ${referralCode}`,
    );
    return { user, referral: referralInfo };
  }

  /**
   * Update user credits
   */
  async updateCredits(userId: string, amount: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: amount,
        },
      },
    });
  }

  /**
   * Check if user has enough credits
   */
  async hasEnoughCredits(userId: string, required: number): Promise<boolean> {
    const user = await this.findById(userId);
    return user ? user.credits >= required : false;
  }

  /**
   * Deduct credits from user
   */
  async deductCredits(userId: string, amount: number): Promise<User> {
    const user = await this.findById(userId);

    if (!user || user.credits < amount) {
      throw new Error('Insufficient credits');
    }

    return this.prisma.user.update({
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
  }

  /**
   * Get user settings
   */
  async getSettings(userId: string): Promise<UserSettings | null> {
    return this.prisma.userSettings.findUnique({
      where: { userId },
    });
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    data: Partial<UserSettings>,
  ): Promise<UserSettings> {
    return this.prisma.userSettings.update({
      where: { userId },
      data,
    });
  }

  /**
   * Get user statistics
   */
  async getStatistics(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        generations: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        referralsGiven: {
          include: {
            referred: {
              select: {
                username: true,
                firstName: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      user: {
        username: user.username,
        credits: user.credits,
        totalGenerated: user.totalGenerated,
        memberSince: user.createdAt,
      },
      recentGenerations: user.generations,
      recentTransactions: user.transactions,
      referrals: user.referralsGiven.length,
      referralsList: user.referralsGiven,
    };
  }

  /**
   * Get referral bonus amount from system settings
   */
  async getReferralBonusAmount(): Promise<number> {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { key: 'singleton' },
    });
    return settings?.referralBonusAmount ?? 50;
  }

  /**
   * Save a chat message
   */
  async saveChatMessage(data: {
    userId: string;
    content: string;
    mode: string;
    isFromUser: boolean;
  }): Promise<void> {
    await this.prisma.chatMessage.create({
      data: {
        userId: data.userId,
        content: data.content,
        mode: data.mode,
        isFromUser: data.isFromUser,
      },
    });
  }
}
