export enum PaymentStatusEnum {
    PENDING = 'PENDING',
    PAID = 'PAID',
    FAILED = 'FAILED',
    CANCELED = 'CANCELED',
}
  

export enum BalanceChangeType {
  PAYMENT = 'PAYMENT',
  MANUALLY = 'MANUALLY',
  SCHEDULER = 'SCHEDULER'
}