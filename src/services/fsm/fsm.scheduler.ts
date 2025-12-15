import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { FSMService } from './fsm.service';
import { OverlayService } from './overlay.service';
import { FSMEvent } from './fsm.types';

@Injectable()
export class FSMScheduler {
    private readonly logger = new Logger(FSMScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly fsmService: FSMService,
        private readonly overlayService: OverlayService,
    ) { }

    /**
     * Runs every minute to check for users who need to transition due to timeouts.
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async handleTimeouts() {
        this.logger.debug('Running FSM timeout checks...');

        // 0. Expire Overlays
        await this.overlayService.expireOverlays();

        // 1. Find transitions with timeouts
        const activeTransitionsWithTimeout = await this.prisma.fSMTransition.findMany({
            where: {
                triggerEvent: FSMEvent.TIMEOUT,
                timeoutMinutes: { not: null },
            },
            include: {
                fromState: true,
            },
        });

        if (activeTransitionsWithTimeout.length === 0) return;

        // Group by state for efficiency
        const stateIds = [...new Set(activeTransitionsWithTimeout.map(t => t.fromStateId))];

        // 2. Find users in these states who have exceeded the time
        // We can't easily check "now - enteredAt > timeout" for different timeouts in one query
        // So we iterate per transition type (or per state if we optimize)

        // Basic approach: Iterate transitions
        for (const transition of activeTransitionsWithTimeout) {
            if (!transition.timeoutMinutes) continue;

            // Calculate cutoff time
            const cutoff = new Date(Date.now() - transition.timeoutMinutes * 60 * 1000);

            // Find users in this state entered before cutoff
            // AND who haven't been checked recently (optional optimization)
            const usersToTransition = await this.prisma.userFSMState.findMany({
                where: {
                    stateId: transition.fromStateId,
                    enteredAt: { lt: cutoff },
                },
                take: 100, // Batch process
            });

            for (const userState of usersToTransition) {
                // Trigger TIMEOUT event for this user
                // The FSMService.trigger will find the transition and re-verify conditions
                await this.fsmService.trigger(userState.userId, FSMEvent.TIMEOUT);
            }
        }
    }
}
