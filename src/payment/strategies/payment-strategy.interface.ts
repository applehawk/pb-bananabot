import { PaymentStatusEnum } from '../enum/payment-status.enum';

/**
 * Payment data structure for payment strategies
 * Replaces old Payment Prisma model
 */
export interface PaymentData {
  paymentId: string;
  form?: string; // HTML form for payment
  amount?: number;
  currency?: string;
  status?: string;
  url: string;
}

export class PaymentProxy {
  _payment: PaymentData;

  constructor(payment: PaymentData) {
    this._payment = payment;
  }
}

export type CreatePaymentData = {
  userId: number;
  chatId: number;
  tariffId: string;
  tariffPrice: number;
  paymentAt?: Date;
};

export interface PaymentStrategy {
  createPayment(data: CreatePaymentData): Promise<PaymentProxy>;
  validateTransaction(paymentId: string): Promise<PaymentStatusEnum>;
}
