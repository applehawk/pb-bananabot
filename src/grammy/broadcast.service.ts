import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { GrammYService } from './grammy.service';
import { ConfigService } from '@nestjs/config';
import { Api } from 'grammy';

@Injectable()
export class BroadcastService {
    private readonly logger = new Logger(BroadcastService.name);
    private isProcessing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly grammyService: GrammYService,
        private readonly configService: ConfigService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleBroadcasts() {
        if (this.isProcessing) {
            this.logger.debug('Broadcast already processing, skipping cycle');
            return;
        }

        try {
            this.isProcessing = true;
            const broadcast = await this.prisma.broadcast.findFirst({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'asc' },
            });

            if (!broadcast) return;

            this.logger.log(`Starting broadcast ${broadcast.id}: "${broadcast.message.substring(0, 20)}..."`);

            // Check if custom bot token is used
            let api = this.grammyService.bot.api;
            if (broadcast.botToken) {
                this.logger.log(`Using custom bot token for broadcast ${broadcast.id}`);
                api = new Api(broadcast.botToken);
            }

            // Determine filter
            const whereClause: any = {};
            if (broadcast.targetNotSubscribed) {
                whereClause.isSubscribed = false;
            }

            // Update status to PROCESSING with accurate count
            const totalCount = await this.prisma.user.count({ where: whereClause });

            await this.prisma.broadcast.update({
                where: { id: broadcast.id },
                data: {
                    status: 'PROCESSING',
                    startedAt: new Date(),
                    totalUsers: totalCount,
                },
            });

            const messageContent = broadcast.message;
            let sentCount = 0;
            let failedCount = 0;
            let cursor: string | undefined;
            const batchSize = 100;

            while (true) {
                const users = await this.prisma.user.findMany({
                    where: whereClause,
                    take: batchSize,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    select: { id: true, telegramId: true },
                    orderBy: { id: 'asc' },
                });

                if (users.length === 0) break;

                // Process batch
                // Telegram rate limit: ~30 msg/sec. 
                // We will do a simple sequential or small concurrent batch with delay to be safe.
                // A simple `for of` with small delay is safest for stability.

                for (const user of users) {
                    try {
                        // Note: Use the selected api instance
                        await api.sendMessage(
                            user.telegramId.toString(),
                            messageContent,
                            { parse_mode: 'HTML' }
                        );

                        // Log success (create AdminMessage - bulk insert is hard with prisma and relations if we want individual records linked)
                        // Creating 10k records might be slow.
                        // Requirement: "сохраняй историй отправленных сообщений пользователю"
                        // So we MUST create AdminMessage for each user.

                        await this.prisma.adminMessage.create({
                            data: {
                                userId: user.id,
                                message: messageContent,
                                isBroadcast: true,
                                broadcastId: broadcast.id,
                                status: 'SENT',
                            }
                        });

                        sentCount++;
                    } catch (error: any) {
                        // Failed
                        failedCount++;
                        // Log failure? using AdminMessage
                        await this.prisma.adminMessage.create({
                            data: {
                                userId: user.id,
                                message: messageContent,
                                isBroadcast: true,
                                broadcastId: broadcast.id,
                                status: 'FAILED',
                                error: error.message || String(error),
                            }
                        });

                        // Check for Blocked user errors and maybe flag user?
                        // (Ignoring for this iteration)
                    }

                    // Small delay to avoid hitting limits aggressively
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                // Update progress periodically
                await this.prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { sentCount, failedCount }
                });

                cursor = users[users.length - 1].id;
            }

            // Completed
            await this.prisma.broadcast.update({
                where: { id: broadcast.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    sentCount,
                    failedCount
                }
            });

            this.logger.log(`Broadcast ${broadcast.id} completed. Sent: ${sentCount}, Failed: ${failedCount}`);

        } catch (error) {
            this.logger.error('Error during broadcast processing', error);
            // Don't mark as FAILED generally unless it's a fatal error, 
            // but maybe we should so it doesn't loop forever if broken.
        } finally {
            this.isProcessing = false;
        }
    }
}
