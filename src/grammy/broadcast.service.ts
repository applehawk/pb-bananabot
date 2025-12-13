import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { GrammYService } from './grammy.service';
import { ConfigService } from '@nestjs/config';
import { Api } from 'grammy';
import { CryptoHelper } from '../utils/crypto.helper';
import { BurnableBonusService } from '../credits/burnable-bonus.service';

@Injectable()
export class BroadcastService {
    private readonly logger = new Logger(BroadcastService.name);
    private isProcessing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly grammyService: GrammYService,
        private readonly configService: ConfigService,
        private readonly burnableBonusService: BurnableBonusService,
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
                where: {
                    status: 'PENDING',
                    OR: [
                        { scheduledFor: null },
                        { scheduledFor: { lte: new Date() } }
                    ]
                },
                include: { creditPackage: true, burnableBonus: true },
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
            if (broadcast.targetUserIds && broadcast.targetUserIds.length > 0) {
                whereClause.id = { in: broadcast.targetUserIds };
            } else if (broadcast.targetNotSubscribed) {
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
            const creditPackage = broadcast.creditPackage;

            let sentCount = 0;
            let failedCount = 0;
            let cursor: string | undefined;
            const batchSize = 100;

            while (true) {
                const users: any[] = await this.prisma.user.findMany({
                    where: whereClause,
                    take: batchSize,
                    skip: cursor ? 1 : 0,
                    cursor: cursor ? { id: cursor } : undefined,
                    select: { id: true, telegramId: true },
                    orderBy: { id: 'asc' },
                });

                if (users.length === 0) break;

                for (const user of users) {
                    try {
                        const extra: any = { parse_mode: 'HTML' };

                        if (creditPackage) {
                            const tariffId = creditPackage.id;
                            const timestamp = Math.floor(Date.now() / 1000);
                            const userIdNum = Number(user.telegramId);

                            const secret = this.configService.get('YOOMONEY_SECRET') || 'secret';
                            const domain = this.configService.get('DOMAIN') || 'https://bananabot.ru';

                            const sign = CryptoHelper.signParams({
                                userId: userIdNum,
                                chatId: userIdNum,
                                tariffId,
                                timestamp
                            }, secret);

                            const paymentUrl = `${domain}/payment/init?userId=${userIdNum}&chatId=${userIdNum}&tariffId=${tariffId}&timestamp=${timestamp}&sign=${sign}`;

                            extra.reply_markup = {
                                inline_keyboard: [[
                                    { text: `${creditPackage.name} - ${creditPackage.price}₽`, url: paymentUrl }
                                ]]
                            };
                        }

                        await api.sendMessage(
                            user.telegramId.toString(),
                            messageContent,
                            extra
                        );

                        await this.prisma.adminMessage.create({
                            data: {
                                userId: user.id,
                                message: messageContent,
                                isBroadcast: true,
                                broadcastId: broadcast.id,
                                status: 'SENT',
                            }
                        });

                        // Grant Burnable Bonus if attached
                        if (broadcast.burnableBonus) {
                            try {
                                await this.burnableBonusService.grantBonus(user.id, broadcast.burnableBonus.id);
                                this.logger.log(`Granted burnable bonus ${broadcast.burnableBonus.id} to user ${user.id} via broadcast`);
                            } catch (e) {
                                this.logger.error(`Failed to grant broadcast bonus to user ${user.id}`, e);
                            }
                        }

                        sentCount++;
                    } catch (error: any) {
                        failedCount++;
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
                    }

                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                await this.prisma.broadcast.update({
                    where: { id: broadcast.id },
                    data: { sentCount, failedCount }
                });

                cursor = users[users.length - 1].id;
            }

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
        } finally {
            this.isProcessing = false;
        }
    }
}
