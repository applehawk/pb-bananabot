import { PaymentStatusEnum } from '../enum/payment-status.enum';
import { Payment } from '@prisma/client';

export class PaymentProxy {
  _payment: Payment = {} as Payment;

  constructor(payment: Partial<Payment>) {
    Object.assign(this._payment, payment);
  }
}

export type CreatePaymentData = {
  userId: number;
  chatId: number;
  tariffId: string;
  tariffPrice: number;
  //paymentMonths: number;
  //email?: string;
  paymentAt?: Date;
  //limit?: number;
};
export interface PaymentStrategy {
  createPayment(data: CreatePaymentData): Promise<PaymentProxy>;
  validateTransaction(paymentId: string): Promise<PaymentStatusEnum>;
}
