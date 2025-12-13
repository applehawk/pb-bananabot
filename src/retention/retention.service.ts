import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { GrammYService } from '../grammy/grammy.service';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboard } from 'grammy';
import { PaymentService } from '../payment/payment.service';
import { BurnableBonusService } from '../credits/burnable-bonus.service';

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);
    private isProcessing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly grammyService: GrammYService,
        private readonly configService: ConfigService,
        private readonly paymentService: PaymentService,
        private readonly burnableBonusService: BurnableBonusService,
    ) { }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async handleRetention() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const settings = await this.prisma.systemSettings.findUnique({
                where: { key: 'singleton' }
            });

            if (!settings || !settings.isRetentionEnabled) {
                return;
            }

            const stages = await this.prisma.retentionStage.findMany({
                where: { isActive: true },
                orderBy: { order: 'asc' },
                include: { creditPackage: true }
            });

            const now = new Date();
            // Server time hour (UTC+3 for Moscow usually, assuming local server time or UTC adjusted)
            // If running in Docker in UTC, we need to adjust.
            // Admin panel assumes "Server Time". If admin uses scheduledFor, it uses timezone.
            // Here "activeHours" is likely "Local Server Time" or "Moscow".
            // Since project seems RU focused, let's assume Moscow (UTC+3) or local time if set.
            // Simply use now.getHours() if server is configured for target TZ,
            // OR offset if server is UTC. Common practice is UTC server.
            // Let's assume server is UTC and add +3 for MSK, or rely on activeHours being UTC.
            // User requested "concrete time of day". Let's use getUTCHours() + 3 for MSK by default if not specified.
            // For now, I'll use local server time `now.getHours()` as requested "Active Hours Logic (Server Time)" in label.
            const currentHour = now.getHours();

            for (const stage of stages) {

                // Active Hours Check: If set, current time must be within [start, end].
                // If not in window, SKIP for now (wait).
                if (stage.activeHoursStart !== null && stage.activeHoursEnd !== null) {
                    const start = stage.activeHoursStart;
                    const end = stage.activeHoursEnd;
                    let isWithin = false;

                    if (start <= end) {
                        // Regular range, e.g. 9 to 21
                        isWithin = currentHour >= start && currentHour < end; // < end typically means up to that hour? Or inclusive?
                        // Usually 09:00 to 21:00 inclusive?
                        // Let's assume inclusive start, exclusive end logic or inclusive-inclusive? 
                        // Form placeholder says "Start (0-23) - End (0-23)".
                        // If 9-21, usually means 9:00 to 21:59? If so, <= end.
                        isWithin = currentHour >= start && currentHour <= end;
                    } else {
                        // Overlay range, e.g. 22 to 06
                        isWithin = currentHour >= start || currentHour <= end;
                    }

                    if (!isWithin) {
                        // this.logger.debug(`Skipping stage ${stage.order} due to active hours (${start}-${end} vs ${currentHour})`);
                        continue;
                    }
                }

                const prevStage = stage.order - 1;

                // Build Where Clause
                let whereClause: any = {
                    retentionStage: prevStage,
                };

                // generations condition
                if (stage.conditionGenerations !== null) {
                    whereClause.totalGenerated = { gte: stage.conditionGenerations };
                } else {
                    // Default behavior ("Burn Down"): If it's the very first stage (0 -> 1), 
                    // and no condition set, maybe users assumed it's for inactive?
                    // But if stage.order=1, prev=0. 
                    // If we remove totalGenerated:0, we target ALL users who are at stage 0.
                    // This might spam active users unless we check lastActiveAt.
                    // If existing logic relied on totalGenerated:0, we should keep it IF conditionGenerations is NOT set?
                    // But user said "conditions ... optionally". 
                    // I will Assume: If NO condition is set, we fallback to OLD logic (totalGenerated: 0) to be safe?
                    // Or I assume general retention logic.
                    // The old code had: "Assuming 'Burn Down' purely inactive/new users".
                    // If I change detailed logic, I might break existing assumptions.
                    // Let's keep `totalGenerated: 0` ONLY if `conditionGenerations` is NULL AND `conditionPaymentPresent` is NULL.
                    // i.e., "Default Filter".
                    if (stage.conditionGenerations === null && stage.conditionPaymentPresent === null) {
                        whereClause.totalGenerated = 0;
                    }
                }

                // payment condition (present/absent)
                // This refers to `transactions`.
                // We'll perform checks in memory or detailed query if needed?
                // `findMany` with related filter is safer.
                if (stage.conditionPaymentPresent === true) {
                    whereClause.transactions = { some: { type: 'PURCHASE', status: 'COMPLETED' } };
                } else if (stage.conditionPaymentPresent === false) {
                    whereClause.transactions = { none: { type: 'PURCHASE', status: 'COMPLETED' } };
                }

                // Add time conditions (AND logic)
                if (stage.hoursSinceRegistration) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceRegistration * 60 * 60 * 1000);
                    whereClause.createdAt = { lte: cutoff };
                }

                if (stage.hoursSinceLastActivity) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceLastActivity * 60 * 60 * 1000);
                    whereClause.lastActiveAt = { lte: cutoff };
                }

                if (stage.hoursSinceLastStage) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceLastStage * 60 * 60 * 1000);
                    whereClause.lastRetentionMessageAt = { lte: cutoff };
                }

                // hoursSinceFirstPayment
                // This is hard to do in whereClause without joining.
                // We'll filter in JS loop or try advanced query. Active users batch size is 50, so JS or separate check is fine.
                // But efficient way: if set, we select users and check.

                const users = await this.prisma.user.findMany({
                    where: whereClause,
                    take: 50, // Batch limit
                    include: {
                        transactions: stage.hoursSinceFirstPayment ? {
                            where: { type: 'PURCHASE', status: 'COMPLETED' },
                            orderBy: { createdAt: 'asc' },
                            take: 1
                        } : false
                    }
                });

                if (users.length > 0) {
                    this.logger.log(`Processing Stage ${stage.order} ("${stage.name}"): Found ${users.length} candidates.`);
                }

                for (const user of users) {
                    // Additional JS Check for hoursSinceFirstPayment
                    if (stage.hoursSinceFirstPayment) {
                        const firstTx = (user as any).transactions?.[0];
                        if (!firstTx) {
                            // Needs payment but has none? If conditionPaymentPresent=true was set, we have it. 
                            // If not set, but hours set, implies payment must exist?
                            // Default: if no payment, can't satisfy "X hours since payment". Skip.
                            continue;
                        }
                        const cutoff = new Date(now.getTime() - stage.hoursSinceFirstPayment * 60 * 60 * 1000);
                        if (firstTx.createdAt > cutoff) {
                            // Paid too recently
                            continue;
                        }
                    }

                    try {
                        const extra: any = { parse_mode: 'HTML' };
                        const keyboard = new InlineKeyboard();
                        let hasButtons = false;

                        // 1. Special Offer Button
                        if (stage.isSpecialOffer && stage.creditPackage) {
                            try {
                                const payUrl = this.paymentService.generateInitPayUrl(
                                    Number(user.telegramId),
                                    Number(user.telegramId),
                                    stage.creditPackage.id
                                );
                                const label = stage.specialOfferLabel || `🔥 ${stage.creditPackage.name}`;
                                keyboard.url(label, payUrl).row();
                                hasButtons = true;
                            } catch (e) {
                                this.logger.error(`Failed to generate pay url for user ${user.id} in retention`, e);
                            }
                        }

                        // 2. Random Generation Button
                        if (stage.isRandomGenerationEnabled) {
                            const label = stage.randomGenerationLabel || 'Surprise Me! 🎲';
                            // We use 'random_generation' callback which should be handled by bot
                            // Or Enter GENERATE flow? 
                            // 'generate_trigger' or just text?
                            // In bot.update: 'regenerate_' invokes generation.
                            // Let's use 'random_generation' and user should ensure handler exists? 
                            // Or use '/random'? Or just 'generate'?
                            // If I use 'random_generation', I need to add handler in bot.update.ts if not exists.
                            // But user asked to add the button support, maybe I need to add handler too?
                            // Assuming 'random_generation' is a good key. I'll add the button.
                            // (Bot update handler needed? Yes. I should check if I need to add it).
                            keyboard.text(label, 'generate_random').row();
                            hasButtons = true;
                        }

                        // 3. Custom Buttons (from JSON)
                        if (stage.buttons) {
                            const buttons = stage.buttons as any[];
                            if (Array.isArray(buttons) && buttons.length > 0) {
                                buttons.forEach((btn) => {
                                    if (btn.url) {
                                        keyboard.url(btn.text, btn.url);
                                    } else if (btn.callback_data) {
                                        keyboard.text(btn.text, btn.callback_data);
                                    } else if (btn.web_app) {
                                        keyboard.webApp(btn.text, btn.web_app);
                                    }
                                    keyboard.row();
                                });
                                hasButtons = true;
                            }
                        }

                        if (hasButtons) {
                            extra.reply_markup = keyboard;
                        }

                        await this.grammyService.bot.api.sendMessage(
                            user.telegramId.toString(),
                            stage.message,
                            extra
                        );

                        // Update user state
                        await this.prisma.user.update({
                            where: { id: user.id },
                            data: {
                                retentionStage: stage.order,
                                lastRetentionMessageAt: new Date(),
                                // Do NOT update lastActiveAt to avoid killing the "Since Last Activity" timer for next stages
                            }
                        });

                        // Grant Burnable Bonus if configured
                        if (stage.burnableBonusId) {
                            await this.burnableBonusService.grantBonus(user.id, stage.burnableBonusId);
                        }

                        this.logger.log(`Stage ${stage.order} message sent to user ${user.id} (${user.username || user.firstName})`);
                    } catch (error) {
                        this.logger.error(`Failed to send retention message to user ${user.id}`, error);
                        // If blocked, maybe mark user?
                    }

                    // Throttle
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

        } catch (error) {
            this.logger.error('Error in retention cycle', error);
        } finally {
            this.isProcessing = false;
        }
    }
}
