import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreditsService } from './credits.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GrammYService } from '../grammy/grammy.service'; // Fix import path if needed

@Injectable()
export class BurnableBonusService {
    private readonly logger = new Logger(BurnableBonusService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly creditsService: CreditsService,
        private readonly grammyService: GrammYService,
    ) { }

    /**
     * Grant a burnable bonus to a user
     */
    async grantBonus(userId: string, burnableBonusId: string) {
        try {
            const bonusTemplate = await this.prisma.burnableBonus.findUnique({
                where: { id: burnableBonusId },
            });

            if (!bonusTemplate) {
                this.logger.error(`BurnableBonus ${burnableBonusId} not found`);
                return;
            }

            // Calculate deadline
            let deadline = new Date();
            if (bonusTemplate.expiresAt) {
                deadline = bonusTemplate.expiresAt;
            } else if (bonusTemplate.expiresInHours) {
                deadline = new Date(Date.now() + bonusTemplate.expiresInHours * 60 * 60 * 1000);
            } else {
                // No expiration? Then effectively a regular bonus.
                // But we treat it as burnable without deadline (infinite).
                deadline = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year fallback
            }

            // Add credits
            await this.creditsService.addCredits(
                userId,
                bonusTemplate.amount,
                'BONUS',
                'FREE',
                { burnableBonusId, type: 'BURNABLE_GRANT' }
            );

            // Create tracking record
            await this.prisma.userBurnableBonus.create({
                data: {
                    userId,
                    amount: bonusTemplate.amount,
                    deadline,
                    generationsRequired: bonusTemplate.conditionGenerations,
                    topUpAmountRequired: bonusTemplate.conditionTopUpAmount,
                    status: 'ACTIVE',
                },
            });

            this.logger.log(`Granted burnable bonus ${bonusTemplate.amount} to user ${userId}`);

            // Notify user
            await this.sendBonusNotification(userId, bonusTemplate.amount, deadline, bonusTemplate.conditionGenerations, bonusTemplate.conditionTopUpAmount);

        } catch (error) {
            this.logger.error(`Failed to grant burnable bonus to user ${userId}`, error);
        }
    }

    /**
     * Notify service about a generation event
     */
    async onGeneration(userId: string) {
        try {
            const activeBonuses = await this.prisma.userBurnableBonus.findMany({
                where: { userId, status: 'ACTIVE' },
            });

            for (const bonus of activeBonuses) {
                const newCount = bonus.generationsMade + 1;

                // Check if condition met
                let limitReached = false;
                if (bonus.generationsRequired && newCount >= bonus.generationsRequired) {
                    limitReached = true;
                }

                if (limitReached) {
                    await this.markCompleted(bonus.id);
                } else {
                    await this.prisma.userBurnableBonus.update({
                        where: { id: bonus.id },
                        data: { generationsMade: newCount },
                    });
                }
            }
        } catch (error) {
            this.logger.error(`Error processing generation event for bonus ${userId}`, error);
        }
    }

    /**
     * Notify service about a payment event
     */
    async onTopUp(userId: string, amount: number) {
        try {
            const activeBonuses = await this.prisma.userBurnableBonus.findMany({
                where: { userId, status: 'ACTIVE' },
            });

            for (const bonus of activeBonuses) {
                const newAmount = bonus.topUpMade + amount;

                let limitReached = false;
                if (bonus.topUpAmountRequired && newAmount >= bonus.topUpAmountRequired) {
                    limitReached = true;
                }

                if (limitReached) {
                    await this.markCompleted(bonus.id);
                } else {
                    await this.prisma.userBurnableBonus.update({
                        where: { id: bonus.id },
                        data: { topUpMade: newAmount },
                    });
                }
            }
        } catch (error) {
            this.logger.error(`Error processing topup event for bonus ${userId}`, error);
        }
    }

    private async markCompleted(userBonusId: string) {
        await this.prisma.userBurnableBonus.update({
            where: { id: userBonusId },
            data: { status: 'COMPLETED' },
        });
        this.logger.log(`Burnable bonus ${userBonusId} SAVED (condition met).`);
    }

    /**
     * Revoke a bonus (expired)
     */
    async revokeBonus(userBonusId: string, amount: number, userId: string) {
        // 1. Check if user has enough credits?
        // User might have spent them. 
        // If they spent them, do we put them in negative? 
        // Usually "Burnable" implies "Use it or lose it". 
        // If they USED it (balance went down), they shouldn't go negative just because they used the bonus. 
        // Wait. "Burnable" means "If you don't use it, it disappears". 
        // BUT the prompt says "Condition to CANCEL burning (and full accrual)".
        // This implies if I generate, I KEEP it.
        // If I DON'T generate, I LOSE it.
        // Logic:
        // User gets +50. Balance 0 -> 50.
        // Case A: User generates 1 image (cost 1). Balance 49. Condition (1 gen) met -> Saved. Balance 49. OK.
        // Case B: User does nothing. Deadline hits. Revoke. Balance 50 -> 0. OK.
        // Case C: User generates 1 image (cost 1). Condition (2 gens) NOT met. Deadline hits.
        //    User spent 1. Balance 49. Revoke 50. Balance -1.
        //    This is BAD. We shouldn't punish usage.
        //    We should only revoke what is *remaining* of that bonus?
        //    Or we accept negative balance?
        //    Or we treat it as "If you used it, great. We remove the REST".
        //    "Use it or Lose it".
        //    So we should remove min(currentBalance, bonusAmount)?
        //    If I have 50 bonus and 100 real credits (Total 150).
        //    I spend 10. Balance 140.
        //    Deadline hits. Remove 50. Balance 90. (I used 10 of "real" or "bonus"? Doesn't matter, fungible).
        //    Effectively I lost the bonus.
        //    If I had 0 real, 50 bonus. Spend 40. Balance 10.
        //    Deadline hits. Remove 50 -> -40? No. Remove 10 -> 0.
        //    So logic: Deduct `amount` but floor at 0?
        //    Or deduct `amount` strictly?
        //    If strict deduction, they go negative.
        //    "Sgorayemyj bonus" (Burnable/Combustible bonus).
        //    Usually in marketing: "Here is 50 credits active for 24h".
        //    If you spend them, good. If not, they vanish.
        //    So we should only deduct what is *left*.
        //    But we don't track which credit is which.
        //    Standard approach: Deduct `amount`, but don't go below 0 (for free users)?
        //    Or simply Deduct `amount` and let them be negative (debt)? - Bad UX.
        //    I will implement: Deduct `min(user.credits, bonusAmount)`.

        //    WAIT. The Prompt says: "Complete accrual to balance" if condition met.
        //    This phrasing "Full accrual" suggests it might NOT be on balance initially?
        //    "Optionally add balance (or better burnable bonus)".
        //    If I add it to balance immediately, it's already "Accrued".
        //    Maybe the user meant: "It's temporary. If condition met, it becomes Permanent."
        //    If NOT met, it is removed.
        //    So my 'Revoke' logic must define what 'Removed' means.
        //    I'll go with `decrement: amount` but check for negative?
        //    Actually, `CreditsService.addCredits` just does `increment`. 
        //    I'll implement a `deductBurnedBonus` in CreditsService or here.

        //    Let's handle the "don't go negative" logic here.

        try {
            await this.prisma.$transaction(async (tx) => {
                const user = await tx.user.findUnique({ where: { id: userId } });
                if (!user) return;

                // Logic: Remove up to 'amount', but don't drop below 0?
                // If I have 100 (Own) + 50 (Bonus). Total 150.
                // Spend 0. Expire. Remove 50. Total 100. Correct.
                // Spend 50. Total 100. Expire. Remove 50. Total 50. (I spent the bonus? Or my own?)
                // If I spent the bonus, why remove another 50?
                // If I spent 50, I effectively used the bonus.
                // "Burnable" means "Use it OR it burns".
                // It doesn't mean "If you use it, we still take 50 later".
                // It means "The UNUSED portion burns".
                // But we don't know the unused portion.
                //
                // Alternative Logic:
                // Bonus is NOT added to `credits` immediately. It is in `bonusCredits`.
                // Total available = `credits` + `bonusCredits`.
                // Usage priority: Bonus first?
                // This requires schema change to `User` (field `bonusCredits`).
                // I did NOT add `bonusCredits` to User in my schema plan. I only added `UserBurnableBonus`.
                //
                // So I must stick to "Added to main credits".
                // In this case, "Burnable" usually means "Conditional Gift".
                // If I grant 50, and you don't meet the "Save" condition (e.g. 1 generation),
                // then I take back 50.
                // Even if you spent it?
                // If you spent it, you *did* a generation. So you met the condition (likely).
                // What if condition is "Top up 500 RUB"?
                // I give 50 credits. You spend 50. You don't top up.
                // Do I put you in -50 debt?
                // Probably yes, or I accept the loss.
                //
                // Given "Bananas" context (likely AI gen bot), users might abuse "Free 50" -> Generate -> Leave.
                // If we don't want that, maybe "Burnable" means "You can see it but can't use it until condition?" NO.
                // "Burnable" means "Expires".
                //
                // I will implement: Deduct `amount` *unless* it puts user below 0? No, that clears debt.
                // I'll implement: Deduct `amount`. If negative, set to 0?
                // "Reset to 0 if negative".

                const newCredits = user.credits - amount;
                const finalCredits = newCredits < 0 ? 0 : newCredits;
                const change = finalCredits - user.credits; // Negative value

                await tx.user.update({
                    where: { id: userId },
                    data: { credits: finalCredits }
                });

                await tx.userBurnableBonus.update({
                    where: { id: userBonusId },
                    data: { status: 'EXPIRED' }
                });

                // Log transaction?
                await tx.transaction.create({
                    data: {
                        userId,
                        type: 'EXPIRED_BONUS',
                        creditsAdded: change,
                        paymentMethod: 'FREE',
                        status: 'COMPLETED',
                        description: 'Burnable bonus expired',
                        completedAt: new Date()
                    }
                });
            });

            this.logger.log(`Revoked bonus ${amount} from user ${userId}`);
        } catch (e) {
            this.logger.error(`Failed to revoke bonus for ${userId}`, e);
        }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleExpirations() {
        // Find active bonuses where deadline < now
        const now = new Date();
        const expired = await this.prisma.userBurnableBonus.findMany({
            where: {
                status: 'ACTIVE',
                deadline: { lt: now }
            }
        });

        for (const bonus of expired) {
            await this.revokeBonus(bonus.id, bonus.amount, bonus.userId);
        }

        if (expired.length > 0) {
            this.logger.log(`Processed ${expired.length} expired bonuses.`);
        }
    }

    private async sendBonusNotification(userId: string, amount: number, deadline: Date, conditionGenerations: number | null, conditionTopUp: number | null) {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user || !user.telegramId) return;

            let conditionText = '';
            if (conditionGenerations) {
                conditionText = `сделать <b>${conditionGenerations} генераций</b>`;
            } else if (conditionTopUp) {
                conditionText = `пополнить баланс на <b>${conditionTopUp}₽</b>`;
            } else {
                return; // No condition, no special notification needed? Or just "Bonus Received"
            }

            // Format hours remaining
            const hours = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60));

            const message = `🔥 <b>Вам начислен сгораемый бонус!</b>\n\n` +
                `Сумма: <b>+${amount} монет</b>\n\n` +
                `Чтобы этот бонус остался у вас навсегда, нужно ${conditionText} в течение <b>${hours} часов</b>.\n\n` +
                `Если условие не выполнить, бонус сгорит. Успевайте! ⏳`;

            await this.grammyService.bot.api.sendMessage(Number(user.telegramId), message, { parse_mode: 'HTML' });

        } catch (e) {
            this.logger.error(`Failed to send bonus notification to ${userId}`, e);
        }
    }

    async getActiveBonuses(userId: string) {
        return this.prisma.userBurnableBonus.findMany({
            where: {
                userId,
                status: 'ACTIVE',
                deadline: { gt: new Date() }
            },
            orderBy: { deadline: 'asc' }
        });
    }
}
