import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { MyContext } from './grammy-context.interface';

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
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
                return true;
            }
        } catch (error) {
            this.logger.error(`Error checking subscription for ${telegramId}:`, error);
            // In case of error (e.g. bot not admin in channel), maybe allow access or log?
            // Safe default: deny if we can't verify, but log it.
            // Or allow if it's a bot error? Let's deny to be safe and showing error might be better.
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
