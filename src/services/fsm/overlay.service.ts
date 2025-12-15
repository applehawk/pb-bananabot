import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User, LifecycleState, OverlayType, FSMEvent, UserOverlay, PaymentMethod } from '@prisma/client';
import { BurnableBonusService } from '../../credits/burnable-bonus.service';
import { BotService } from '../../grammy/bot.service';
import { PaymentService } from '../../payment/payment.service';
import { PaymentSystemEnum } from '../../payment/enum/payment-system.enum';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class OverlayService {
    private readonly logger = new Logger(OverlayService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly burnableBonusService: BurnableBonusService,
        @Inject(forwardRef(() => BotService))
        private readonly botService: BotService,
        @Inject(forwardRef(() => PaymentService))
        private readonly paymentService: PaymentService
    ) { }

    /**
     * Main entry point to evaluate overlays based on a user event.
     * This logic runs IN PARALLEL to the main Lifecycle FSM.
     */
    async process(user: User, event: FSMEvent): Promise<void> {
        try {
            // 1. Check Tripwire (Monetization Nudge)
            await this.checkTripwire(user, event);

            // 2. Check Burnable Bonus (Reward)
            await this.checkBurnableBonus(user, event);

            // 3. Check Referral (Viral)
            await this.checkReferral(user, event);

        } catch (error) {
            this.logger.error(`Error processing overlays for user ${user.id}: ${error.message}`, error.stack);
        }
    }

    /**
     * TRIPWIRE RULE:
     * IF Lifecycle == ACTIVE_FREE (or ACTIVATING)
     * AND Not Paid
     * AND Gens >= 3
     * AND Credits < 5 (Low balance)
     * AND No active Tripwire
     * -> ACTIVATE TRIPWIRE
     */
    async activateTripwire(user: User, silent: boolean = false) {
        // Double check existence to be safe, though 'force' might imply override. 
        // For now, we idempotent-check.
        const existing = await this.prisma.userOverlay.findFirst({
            where: {
                userId: user.id,
                type: OverlayType.TRIPWIRE,
                state: { in: ['ACTIVE', 'ELIGIBLE'] }
            }
        });

        if (existing) return;

        this.logger.log(`Activating TRIPWIRE for user ${user.id}`);
        await this.prisma.userOverlay.create({
            data: {
                userId: user.id,
                type: OverlayType.TRIPWIRE,
                state: 'ACTIVE',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
            }
        });

        if (!silent) {
            await this.sendTripwireMessage(user);
        }
    }

    private async sendTripwireMessage(user: User) {
        try {
            // Fetch Tripwire Package
            const settings = await this.prisma.systemSettings.findUnique({ where: { key: 'singleton' } });
            const packageId = settings?.tripwirePackageId;

            if (!packageId) {
                this.logger.warn(`No tripwirePackageId configured in SystemSettings. Cannot send tripwire message to user ${user.id}`);
                return;
            }

            const pkg = await this.prisma.creditPackage.findUnique({ where: { id: packageId } });
            if (!pkg) {
                this.logger.warn(`Tripwire package ${packageId} not found.`);
                return;
            }

            // Create Payment/URL
            // We use YooMoney by default for RU users or general
            // Use PaymentService to generate URL or just a callback button if we use PaymentScene?
            // The user's example used a direct URL.
            // But PaymentService.createPayment returns a Transaction which has a URL (if supported) or we need to start flow.
            // For a button, we usually want "Pay" button to open URL directly or trigger a command.

            // Let's fallback to creating a pending transaction and getting the URL for YooMoney
            const transaction = await this.paymentService.createPayment(user.id, pkg.id, PaymentSystemEnum.YOOMONEY);

            // Assuming metadata.url is where the link is (YooMoney returns confirmationUrl)
            const url = (transaction.metadata as any)?.url || (transaction.metadata as any)?.confirmation?.confirmation_url || null;

            if (!url) {
                this.logger.warn('Could not generate payment URL for Tripwire');
                return;
            }

            const kb = new InlineKeyboard()
                .url(`🚀 Купить старт за ${pkg.priceYooMoney || pkg.price}₽`, url)
                .row()
                .text('🔙 Отмена', 'cancel_generation'); // Or 'hide_overlay'

            await this.botService.sendMessage(
                Number(user.telegramId),
                `<b>⚠️ Недостаточно кредитов!</b>\n\n` +
                `Но для новичков у нас есть спецпредложение!\n` +
                `<b>${pkg.name}</b>: ${pkg.credits} монет всего за <b>${pkg.priceYooMoney || pkg.price} рублей</b>.\n` +
                `Хватит на ~50 генераций!`,
                { reply_markup: kb }
            );

        } catch (e) {
            this.logger.error(`Failed to send Tripwire message to ${user.id}: ${e.message}`);
        }
    }

    /**
     * TRIPWIRE RULE:
     * IF Lifecycle == ACTIVE_FREE (or ACTIVATING)
     * AND Not Paid
     * AND Gens >= 3
     * AND Credits < 5 (Low balance)
     * AND No active Tripwire
     * -> ACTIVATE TRIPWIRE
     */
    private async checkTripwire(user: User, event: FSMEvent) {
        // Only relevant on usage events
        if (event !== FSMEvent.GENERATION_COMPLETED && event !== FSMEvent.CREDITS_CHANGED && event !== FSMEvent.CREDITS_ZERO) return;

        // 1. Eligibility Check
        const eligibleStates: LifecycleState[] = ['ACTIVE_FREE', 'ACTIVATING'];
        if (!eligibleStates.includes(user.lifecycleState)) return;

        // Check engagement
        if (user.totalGenerated < 3) return;

        // Check credits
        if (user.credits >= 5) return;

        // 3. Action: Create Overlay (Logic extracted)
        await this.activateTripwire(user);
    }

    /**
     * BONUS RULE:
     * IF Lifecycle == PAID_ACTIVE
     * AND Generations % 50 == 0
     * -> GRANT BONUS
     */
    async grantBonus(user: User, amount: number = 25, reason: string = 'bonus', hours: number = 6) {
        // Check if already active to prevent spamming
        // We check UserBurnableBonus directly or UserOverlay? 
        // If we want to align with "Overlay" architecture, we check Overlay.
        const activeBonus = await this.prisma.userOverlay.findFirst({
            where: { userId: user.id, type: OverlayType.BONUS, state: 'ACTIVE' }
        });
        if (activeBonus) return;

        this.logger.log(`Granting BURNABLE_BONUS for user ${user.id}`);

        // 1. Create Overlay (Visual State)
        await this.prisma.userOverlay.create({
            data: {
                userId: user.id,
                type: OverlayType.BONUS,
                state: 'ACTIVE',
                expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
                metadata: { amount, reason }
            }
        });

        // 2. Grant Actual Credits (Financial State)
        await this.burnableBonusService.grantAdHocBonus(user.id, amount, hours, reason);
    }

    /**
     * BONUS RULE:
     * IF Lifecycle == PAID_ACTIVE
     * AND Generations % 50 == 0
     * -> GRANT BONUS
     */
    private async checkBurnableBonus(user: User, event: FSMEvent) {
        if (event !== FSMEvent.GENERATION_COMPLETED) return;
        if (user.lifecycleState !== 'PAID_ACTIVE') return;

        // Modulo check (simplified, effectively every 50th gen)
        if (user.totalGenerated > 0 && user.totalGenerated % 50 === 0) {
            await this.grantBonus(user, 25, 'milestone_50');
        }
    }

    /**
     * REFERRAL RULE:
     * IF Lifecycle == PAID_ACTIVE
     * AND No referral overlay ever
     * -> ENABLE REFERRAL
     */
    async enableReferral(user: User, silent: boolean = false) {
        const existing = await this.prisma.userOverlay.findFirst({
            where: { userId: user.id, type: OverlayType.REFERRAL }
        });

        if (!existing) {
            this.logger.log(`Enabling REFERRAL for user ${user.id}`);
            await this.prisma.userOverlay.create({
                data: {
                    userId: user.id,
                    type: OverlayType.REFERRAL,
                    state: 'ELIGIBLE'
                }
            });

            if (!silent) {
                // Determine ReferraL Link
                // const link = `https://t.me/MyBot?start=${user.referralCode}`;
                const botInfo = await this.botService['grammyService'].bot.api.getMe(); // Hack to get bot username if needed? Or just hardcode
                const link = `https://t.me/${botInfo.username}?start=${user.referralCode}`;

                await this.botService.sendMessage(
                    Number(user.telegramId),
                    `🤝 <b>Реферальная программа активирована!</b>\n\n` +
                    `Приглашайте друзей и получайте бонусы!\n` +
                    `Ваша ссылка: ${link}`
                );
            }
        }
    }

    async activateSpecialOffer(user: User, offerId: string, silent: boolean = false) {
        this.logger.log(`Activating SPECIAL_OFFER ${offerId} for user ${user.id}`);
        // Implementation for generic special offers
        await this.prisma.userOverlay.create({
            data: {
                userId: user.id,
                type: OverlayType.SPECIAL_OFFER,
                state: 'ACTIVE',
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h default
                metadata: { offerId }
            }
        });

        if (!silent) {
            await this.sendSpecialOfferMessage(user, offerId);
        }
    }

    private async sendSpecialOfferMessage(user: User, offerId: string) {
        try {
            // Assuming offerId is a CreditPackage ID for now
            const pkg = await this.prisma.creditPackage.findUnique({ where: { id: offerId } });
            if (!pkg) {
                this.logger.warn(`Special Offer package ${offerId} not found.`);
                return;
            }

            const transaction = await this.paymentService.createPayment(user.id, pkg.id, PaymentSystemEnum.YOOMONEY);
            const url = (transaction.metadata as any)?.url || (transaction.metadata as any)?.confirmation?.confirmation_url || null;

            if (!url) return;

            const kb = new InlineKeyboard()
                .url(`🔥 Купить: ${pkg.name}`, url);

            await this.botService.sendMessage(
                Number(user.telegramId),
                `✨ <b>Специальное предложение!</b>\n\n` +
                `Только для вас: <b>${pkg.name}</b>\n` +
                `${pkg.credits} монет за ${pkg.priceYooMoney || pkg.price}₽`,
                { reply_markup: kb }
            );
        } catch (e) {
            this.logger.error(`Failed to send Special Offer to ${user.id}: ${e.message}`);
        }
    }

    /**
     * REFERRAL RULE:
     * IF Lifecycle == PAID_ACTIVE
     * AND No referral overlay ever
     * -> ENABLE REFERRAL
     */
    private async checkReferral(user: User, event: FSMEvent) {
        if (user.lifecycleState !== 'PAID_ACTIVE') return;

        // Only check once in a while or on specific events? 
        // Let's check on PAYMENT_COMPLETED usually, but here we can check periodically.
        if (event !== FSMEvent.PAYMENT_COMPLETED) return;

        await this.enableReferral(user);
    }

    /**
     * CRON TASK: Checks for expired overlays and transitions them.
     */
    async expireOverlays() {
        const now = new Date();

        // Find active/eligible overlays that passed their expiry date
        const expired = await this.prisma.userOverlay.findMany({
            where: {
                state: { in: ['ACTIVE', 'ELIGIBLE'] },
                expiresAt: { lt: now }
            },
            take: 100 // Batch size
        });

        for (const overlay of expired) {
            await this.prisma.userOverlay.update({
                where: { id: overlay.id },
                data: { state: 'EXPIRED' }
            });
            this.logger.log(`Overlay expired: ${overlay.type} for user ${overlay.userId}`);

            // Trigger Notification? "Your bonus has expired."
        }
    }
    /**
     * Public API for UI/Bot to check active overlays
     */
    async getActiveOverlays(userId: string): Promise<UserOverlay[]> {
        return this.prisma.userOverlay.findMany({
            where: {
                userId,
                state: { in: ['ACTIVE', 'ELIGIBLE'] }
            }
        });
    }

    async hasOverlay(userId: string, type: OverlayType): Promise<boolean> {
        const count = await this.prisma.userOverlay.count({
            where: {
                userId,
                type,
                state: { in: ['ACTIVE', 'ELIGIBLE'] }
            }
        });
        return count > 0;
    }
}
