import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentScheduler {
    private readonly logger = new Logger(PaymentScheduler.name);

    constructor(
        private readonly paymentService: PaymentService,
    ) { }

    /**
     * Periodically check for pending payments and validate them.
     * This serves as a fallback mechanism if webhook or redirect fails.
     */
    @Cron(CronExpression.EVERY_10_SECONDS)
    async handlePendingPayments() {
        try {
            const pendingPayments = await this.paymentService.getPendingPayments();

            if (pendingPayments.length) {
                // Log only if there are pending payments to avoid noise
                this.logger.debug(`Found ${pendingPayments.length} pending payments. Validating...`);

                for (const payment of pendingPayments) {
                    try {
                        // Check if payment is older than 10 minutes
                        const now = new Date().getTime();
                        const createdAt = new Date(payment.createdAt).getTime();
                        const diffMinutes = (now - createdAt) / 1000 / 60;

                        if (diffMinutes > 15) {
                            await this.paymentService.failPayment(payment.paymentId, 'Timeout > 10 min');
                            continue;
                        }

                        // validatePayment handles the check, crediting, and status update
                        await this.paymentService.validatePayment(payment.paymentId);
                    } catch (error) {
                        this.logger.error(
                            `Error validating payment ${payment.paymentId}: ${error.message}`,
                            error.stack
                        );
                    }
                }
            }
        } catch (e) {
            this.logger.error('Error in payment scheduler loop', e);
        }
    }
}
