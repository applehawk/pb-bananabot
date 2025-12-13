import { Injectable, Logger } from '@nestjs/common';
import {
  CreditPackage,
  Transaction,
  TransactionType,
  TransactionStatus,
  PaymentMethod,
} from '@prisma/client';
import { PaymentSystemEnum } from './enum/payment-system.enum';
import { PaymentStatusEnum } from './enum/payment-status.enum';
import { DateTime } from 'luxon';
import { YooMoneyNotification } from '@app/yoomoney-client/types/notification.type';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { YooMoneyClient } from '@app/yoomoney-client';
import { PaymentStrategyFactory } from './strategies/factory/payment-strategy.factory';
import { GrammYService } from '../grammy/grammy.service'; // Fix import path if needed
import { UserService } from '../user/user.service';
import { CreditsService } from '../credits/credits.service';
import { BurnableBonusService } from '../credits/burnable-bonus.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Payment Service (adapted for Credits System)
 *
 * Handles:
 * - Creating payments for credit packages (YooMoney, Stars, Crypto)
 * - Validating payment status
 * - Webhook notifications from payment providers
 * - Credit crediting after successful payment
 */
import { CryptoHelper } from '../utils/crypto.helper';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly creditsService: CreditsService,
    private readonly prisma: PrismaService,
    private readonly paymentStrategyFactory: PaymentStrategyFactory,
    private readonly yooMoney: YooMoneyClient,
    private readonly grammyService: GrammYService,
    private readonly burnableBonusService: BurnableBonusService,
  ) { }

  generateInitPayUrl(userId: number, chatId: number, tariffId: string): string {
    const domain = this.configService.get('DOMAIN');
    const secret = this.configService.get('YOOMONEY_SECRET') || 'default_secret'; // Fallback or strict? Better strict but user said fallback ok.

    const params = {
      userId,
      chatId,
      tariffId,
      timestamp: Date.now(),
    };

    const sign = CryptoHelper.signParams(params, secret);
    const query = new URLSearchParams({
      ...params as any,
      sign,
    }).toString();

    return `${domain}/payment/init?${query}`;
  }

  /**
   * Get all pending payments (transactions)
   */
  async getPendingPayments(): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        type: TransactionType.PURCHASE,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /**
   * Find payment transaction by external payment ID
   */
  async findPaymentByPaymentId(paymentId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { paymentId: paymentId },
      include: { package: true },
    });
  }

  /**
   * Create a new payment for a credit package
   *
   * @param userId - Telegram user ID (BigInt as string)
   * @param packageId - Credit package ID
   * @param paymentSystem - Payment system (YOOMONEY, STARS, CRYPTO)
   * @param paymentAt - Payment initiation date
   */
  async createPayment(
    userId: string,
    packageId: string,
    paymentSystem: PaymentSystemEnum,
    paymentAt?: Date,
  ): Promise<Transaction> {
    const user = await this.userService.findByTelegramId(BigInt(userId));
    if (!user) throw new Error('User not found');

    const creditPackage = await this.prisma.creditPackage.findUnique({
      where: { id: packageId },
    });
    if (!creditPackage)
      throw new Error(`Credit package with id ${packageId} not found`);

    // Determine payment method and price
    let paymentMethod: PaymentMethod;
    let price: number;

    switch (paymentSystem) {
      case PaymentSystemEnum.YOOMONEY:
        paymentMethod = PaymentMethod.YOOMONEY;
        price = creditPackage.priceYooMoney || creditPackage.price;
        break;
      case PaymentSystemEnum.STARS:
        paymentMethod = PaymentMethod.TELEGRAM_STARS;
        price = creditPackage.priceStars || creditPackage.price;
        break;
      case PaymentSystemEnum.CRYPTO:
        paymentMethod = PaymentMethod.CRYPTO;
        price = creditPackage.priceCrypto || creditPackage.price;
        break;
      default:
        throw new Error(`Unsupported payment system: ${paymentSystem}`);
    }

    // Create payment using strategy pattern
    const paymentStrategy =
      this.paymentStrategyFactory.createPaymentStrategy(paymentSystem);

    const paymentData = await paymentStrategy.createPayment({
      userId: Number(user.telegramId), // Legacy interface expects number
      chatId: Number(user.telegramId),
      tariffId: creditPackage.id, // Legacy field name (was tariffId, now packageId)
      tariffPrice: price, // Legacy field name
      paymentAt: paymentAt || DateTime.local().toJSDate(),
    });

    // Create Transaction record
    const transaction = await this.prisma.transaction.create({
      data: {
        userId: user.id,
        type: TransactionType.PURCHASE,
        amount: price,
        creditsAdded: creditPackage.credits,
        paymentMethod,
        paymentId: paymentData._payment.paymentId,
        currency: creditPackage.currency,
        packageId: creditPackage.id,
        status: TransactionStatus.PENDING,
        isFinal: false,
        metadata: {
          form: paymentData._payment.form,
          url: paymentData._payment.url, // Save direct URL
          packageName: creditPackage.name,
        },
        description: `Purchase ${creditPackage.name} (${creditPackage.credits} credits)`,
      },
    });

    return transaction;
  }

  /**
   * Validates and fails a payment if expired or manually cancelled
   */
  async failPayment(paymentId: string, reason: string): Promise<void> {
    const transaction = await this.findPaymentByPaymentId(paymentId);
    if (!transaction) return;

    if (transaction.status === TransactionStatus.PENDING) {
      this.logger.log(`Marking payment ${paymentId} as FAILED: ${reason}`);

      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          isFinal: true,
          description: `${transaction.description} [FAILED: ${reason}]`,
        },
      });
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: TransactionStatus,
    isFinal: boolean,
  ): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: { paymentId: paymentId },
      data: {
        status: status,
        isFinal: isFinal,
        completedAt: isFinal ? new Date() : undefined,
      },
    });
  }

  /**
   * Validate payment and credit user if paid
   */
  async validatePayment(paymentId: string): Promise<boolean> {
    const transaction = await this.findPaymentByPaymentId(paymentId);
    if (!transaction)
      throw new Error(`Transaction with paymentId ${paymentId} not found`);

    this.logger.debug(`Payment status: ${transaction.status}`);

    const paymentStrategy = this.paymentStrategyFactory.createPaymentStrategy(
      PaymentSystemEnum[transaction.paymentMethod as keyof typeof PaymentSystemEnum],
    );

    const externalStatus = await paymentStrategy.validateTransaction(paymentId);

    // Map to TransactionStatus
    const isPaid = externalStatus === 'PAID'; // PaymentStatusEnum.PAID

    if (isPaid && transaction.status !== TransactionStatus.COMPLETED) {
      this.logger.log(
        `Payment ${paymentId} confirmed. Crediting ${transaction.creditsAdded} credits to user ${transaction.userId}`,
      );

      // Get package name from metadata (already included via findPaymentByPaymentId)
      const packageName =
        (transaction.metadata as any)?.packageName || 'Credit Package';

      // Credit user directly (updating balance) without creating a duplicate transaction record
      // The existing "PENDING" transaction will be updated to "COMPLETED" and serve as the record.
      await this.userService.updateCredits(transaction.userId, transaction.creditsAdded);

      // Update transaction status
      await this.updatePaymentStatus(
        paymentId,
        TransactionStatus.COMPLETED,
        true,
      );

      // Fetch User (needed for notifications and referral)
      let user = null;
      try {
        user = await this.userService.findById(transaction.userId);
      } catch (e) {
        this.logger.error(`Failed to fetch user ${transaction.userId} for notifications`, e);
      }

      // NOTIFY USER
      if (user && user.telegramId) {
        try {
          await this.grammyService.bot.api.sendMessage(
            Number(user.telegramId),
            `✅ <b>Оплата прошла успешно!</b>\n\nВам начислено <b>${transaction.creditsAdded}</b> монет бани.` +
            `\nТекущий баланс: ${user.credits.toFixed(1)} монет`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {
          this.logger.error(`Failed to send payment notification to ${transaction.userId}`, e);
        }
      }

      // NOTIFY ADMINS
      if (user) {
        try {
          await this.notifyAdmins(transaction, user.username || user.firstName);
        } catch (e) {
          this.logger.error(`Failed to notify admins about payment ${paymentId}`, e);
        }
      }

      // Check Burnable Bonuses (Conditions)
      await this.burnableBonusService.onTopUp(transaction.userId, transaction.amount || 0);

      // === REFERRAL LOGIC: First Purchase Bonus ===
      try {
        // Check if user was referred by someone
        // User already fetched
        if (user && user.referredBy) {
          // Find the referral record
          const referral = await this.prisma.referral.findFirst({
            where: {
              referredId: user.id,
              // First purchase not yet recorded
              firstPurchase: false,
            },
            include: { referrer: true },
          });

          if (referral) {
            // Get system settings for bonus amount
            const settings = await this.prisma.systemSettings.findUnique({
              where: { key: 'singleton' },
            });
            const bonusAmount = settings?.referralFirstPurchaseBonus ?? 150;

            // Update Referral Record
            await this.prisma.referral.update({
              where: { id: referral.id },
              data: {
                firstPurchase: true,
                firstPurchaseBonus: bonusAmount,
              },
            });

            // Credit Referrer
            await this.creditsService.addCredits(
              referral.referrerId,
              bonusAmount,
              TransactionType.REFERRAL,
              PaymentMethod.FREE, // System bonus
              {
                description: `Bonus for first purchase of invited user ${user.username || user.firstName}`,
                sourceUserId: user.id,
              },
            );

            // Notify Referrer
            if (referral.referrer.telegramId) {
              await this.grammyService.bot.api.sendMessage(
                Number(referral.referrer.telegramId),
                `🎉 <b>Реферальный бонус!</b>\n\nВаш приглашенный друг совершил первую покупку.\nВам начислено <b>${bonusAmount}</b> монет бани!`,
                { parse_mode: 'HTML' }
              );
            }

            this.logger.log(`Granted ${bonusAmount} first-purchase bonus to referrer ${referral.referrerId}`);
          }
        }
      } catch (e) {
        this.logger.error(`Failed to process referral first-purchase bonus for user ${transaction.userId}`, e);
      }

      this.logger.log(`Payment ${paymentId} processing completed`);
    } else if (!isPaid && externalStatus !== transaction.status) {
      // Update status if changed but not paid
      this.logger.debug(
        `Payment ${paymentId} status changed to ${externalStatus}`,
      );
      let status: TransactionStatus;
      if (externalStatus === PaymentStatusEnum.CANCELED) {
        status = TransactionStatus.CANCELLED;
      } else {
        status = externalStatus as unknown as TransactionStatus;
      }

      const isFinalStatus =
        status === TransactionStatus.FAILED ||
        status === TransactionStatus.CANCELLED;

      await this.updatePaymentStatus(
        paymentId,
        status,
        isFinalStatus,
      );
    }

    return isPaid;
  }

  /**
   * Get payment form HTML
   */
  async getPaymentForm(paymentId: string): Promise<string> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { paymentId: paymentId },
    });

    if (!transaction)
      throw new Error(`Transaction with paymentId ${paymentId} not found`);

    const metadata = transaction.metadata as any;
    return metadata?.form || '';
  }

  /**
   * YooMoney Webhook Handler
   *
   * Validates webhook signature and credits user if payment is successful
   */
  async yooMoneyWebHook({
    operation_id,
    notification_type,
    datetime,
    sha1_hash,
    sender,
    codepro,
    currency,
    amount,
    label, // paymentId
  }: YooMoneyNotification): Promise<boolean> {
    const secret = this.configService.get('payment.yoomoney.secret');

    // Validate signature
    const hashString = [
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      secret,
      label,
    ].join('&');

    const calculatedHash = createHash('sha1').update(hashString).digest('hex');

    if (calculatedHash !== sha1_hash) {
      this.logger.warn(`YooMoney webhook signature mismatch for ${label}`);
      return false;
    }

    // Double-check with API
    const operationDetails =
      await this.yooMoney.getOperationDetails(operation_id);

    if (
      operationDetails.operation_id === operation_id &&
      operationDetails.amount === parseFloat(amount) &&
      operationDetails.sender === sender &&
      operationDetails.label === label
    ) {
      this.logger.log(`YooMoney payment ${label} confirmed via webhook`);

      // Trigger standard validation (credits user + updates status)
      await this.validatePayment(label);

      return true;
    }

    this.logger.warn(`YooMoney webhook validation failed for ${label}`);
    return false;
  }

  /**
   * Get all active credit packages
   */
  async getActiveCreditPackages(): Promise<CreditPackage[]> {
    return this.prisma.creditPackage.findMany({
      where: { active: true },
      orderBy: [{ popular: 'desc' }, { price: 'asc' }],
    });
  }

  /**
   * Get specific credit package
   */
  async getCreditPackage(packageId: string): Promise<CreditPackage | null> {
    return this.prisma.creditPackage.findUnique({
      where: { id: packageId },
    });
  }

  private async notifyAdmins(transaction: Transaction, username: string) {
    const admins = await this.prisma.adminUser.findMany({
      where: { telegramId: { not: null } }
    });

    const message = `💰 <b>Новая оплата!</b>\n\n` +
      `Пользователь: <b>@${username}</b> (ID: ${transaction.userId})\n` +
      `Сумма: <b>${transaction.amount} ${transaction.currency}</b>\n` +
      `Пакет: ${transaction.creditsAdded} монет\n` +
      `Система: ${transaction.paymentMethod}`;

    for (const admin of admins) {
      if (!admin.telegramId) continue;
      try {
        await this.grammyService.bot.api.sendMessage(Number(admin.telegramId), message, { parse_mode: 'HTML' });
      } catch (e) {
        this.logger.error(`Failed to send admin notification to ${admin.telegramId}`, e);
      }
    }
  }
}
