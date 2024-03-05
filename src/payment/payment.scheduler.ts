import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

import { BotService } from 'src/bot.service';
import { PaymentService } from './payment.service';
import { UserService } from 'src/user/user.service';
import { PaymentStatusEnum } from './enum/payment-status.enum';
import { PaymentSystemEnum } from './enum/payment-system.enum';
import { BalanceChangeStatusEnum } from './enum/balancechange-status.enum';
import { BalanceChangeTypeEnum } from './enum/balancechange-type.enum';
import { BalanceChange } from '@prisma/client';

@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly botService: BotService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMidnight() {
    const serviceFee = this.botService.minimumBalance
    const users = await this.userService.usersWithBalance(serviceFee)
    for (const user of users) {
      await this.userService.commitBalanceChange(user, -serviceFee, BalanceChangeTypeEnum.SCHEDULER)
      .then(async balanceChange => {
          if(balanceChange.status == BalanceChangeStatusEnum.INSUFFICIENT) {
            await this.botService.sendInsufficientChargeMessage(
              user.chatId,
              user.balance, balanceChange.changeAmount
            )
          }
        })
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePendingPayments() {
    const pendingPayments = await this.paymentService.getPendingPayments();

    if (pendingPayments.length) {
      this.logger.debug('Start validating pending payments');
      for (const payment of pendingPayments) {
        try {
          const isPaid = await this.paymentService.validatePayment(payment.paymentId);

          if (isPaid) {
            const user = await this.userService.findOneByUserId(payment.userId);

            this.logger.debug(`Payment with id ${payment.paymentId} is paid`);
            await this.botService.sendPaymentSuccessMessage(
              payment.chatId,
              user.balance,
            );
            await this.botService.sendPaymentSuccessMessageToAdmin(
              user.username,
              user.balance,
              payment.amount,
              PaymentSystemEnum[payment.paymentSystem],
            );
          }
        } catch (error) {
          this.logger.error(`Error validating payment with id ${payment.paymentId}: ${error.message}`);
        }
      }

      this.logger.debug('Finish validating pending payments');
    }
  }

}