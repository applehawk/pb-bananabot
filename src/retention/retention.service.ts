import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { GrammYService } from '../grammy/grammy.service';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboard } from 'grammy';

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);
    private isProcessing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly grammyService: GrammYService,
        private readonly configService: ConfigService,
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
                orderBy: { order: 'asc' }
            });

            const now = new Date();

            for (const stage of stages) {
                const prevStage = stage.order - 1;

                // Base filter: correct previous stage and inactive (no generations)
                // Assuming "Burn Down" targeting purely inactive/new users
                let whereClause: any = {
                    retentionStage: prevStage,
                    totalGenerated: 0,
                };

                // Add time conditions (AND logic)
                if (stage.hoursSinceRegistration) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceRegistration * 60 * 60 * 1000);
                    whereClause.createdAt = { lte: cutoff };
                }

                if (stage.hoursSinceLastActivity) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceLastActivity * 60 * 60 * 1000);
                    // Merge with existing createdAt filter if present? No, they are separate fields.
                    whereClause.lastActiveAt = { lte: cutoff };
                }

                if (stage.hoursSinceLastStage) {
                    const cutoff = new Date(now.getTime() - stage.hoursSinceLastStage * 60 * 60 * 1000);
                    whereClause.lastRetentionMessageAt = { lte: cutoff };
                }

                const users = await this.prisma.user.findMany({
                    where: whereClause,
                    take: 50 // Safe batch size
                });

                if (users.length > 0) {
                    this.logger.log(`Processing Stage ${stage.order} ("${stage.name}"): Found ${users.length} candidates.`);
                }

                for (const user of users) {
                    try {
                        const extra: any = { parse_mode: 'HTML' };

                        if (stage.buttons) {
                            const buttons = stage.buttons as any[]; // Json type
                            if (Array.isArray(buttons) && buttons.length > 0) {
                                const keyboard = new InlineKeyboard();
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
                                extra.reply_markup = keyboard;
                            }
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
