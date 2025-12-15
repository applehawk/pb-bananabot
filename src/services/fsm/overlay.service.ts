
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { User, LifecycleState, OverlayType, FSMEvent, UserOverlay } from '@prisma/client';
import { BurnableBonusService } from '../../credits/burnable-bonus.service';



@Injectable()
export class OverlayService {
    private readonly logger = new Logger(OverlayService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly burnableBonusService: BurnableBonusService
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
    async activateTripwire(user: User) {
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

        // TODO: Emit side-effect (Trigger Notification message via BotService)
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
        if (event !== FSMEvent.GENERATION && event !== FSMEvent.CREDITS_CHANGED && event !== FSMEvent.CREDITS_ZERO) return;

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
        if (event !== FSMEvent.GENERATION) return;
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
    async enableReferral(user: User) {
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
        }
    }

    async activateSpecialOffer(user: User, offerId: string) {
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
