import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { MyContext } from './grammy-context.interface';

import { FSMService } from '../services/fsm/fsm.service';
import { FSMEvent } from '../services/fsm/fsm.types';

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly fsmService: FSMService,
    ) { }

    /**
     * Check if a user needs to subscribe and if they are subscribed.
     * Returns true if the user IS subscribed or DOES NOT need to subscribe.
     * Returns false if the user IS NOT subscribed and IS required to.
     */
    async checkSubscriptionAccess(ctx: MyContext, userId: string, telegramId: bigint): Promise<boolean> {
        const systemSettings = await this.prisma.systemSettings.findUnique({
            where: { key: 'singleton' },
        });

        if (!systemSettings?.isSubscriptionRequired || !systemSettings?.telegramChannelId) {
            return true; // Global requirement off or channel not set
        }

        const userSettings = await this.prisma.userSettings.findUnique({
            where: { userId },
        });

        if (userSettings && !userSettings.isSubscriptionRequired) {
            return true; // User specifically exempt
        }

        // Check database flag first (cache)
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { isSubscribed: true },
        });

        if (user?.isSubscribed) {
            return true;
        }

        // If not subscribed in DB, check live
        try {
            const chatMember = await ctx.api.getChatMember(systemSettings.telegramChannelId, Number(telegramId));
            const isMember = ['creator', 'administrator', 'member', 'restricted'].includes(chatMember.status);

            if (isMember) {
                // Update cache
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { isSubscribed: true },
                });

                // Trigger FSM Event
                this.fsmService.trigger(userId, FSMEvent.CHANNEL_SUBSCRIPTION, {
                    reason: 'User verified subscription to channel'
                }).catch(e => this.logger.warn(`Failed to trigger CHANNEL_SUBSCRIPTION: ${e.message}`));

                return true;
            }
        } catch (error) {
            // Log as warning, not error, to reduce noise for configuration issues
            this.logger.warn(`Subscription check failed for user ${telegramId} in channel ${systemSettings.telegramChannelId}: ${error.message}`);
            // Return false (deny access) by default if check fails
            return false;
        }

        return false;
    }

    async getChannelId(): Promise<string | null> {
        const settings = await this.prisma.systemSettings.findUnique({
            where: { key: 'singleton' },
            select: { telegramChannelId: true },
        });
        return settings?.telegramChannelId || null;
    }
}
