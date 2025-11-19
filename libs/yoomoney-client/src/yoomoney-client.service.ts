import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  API,
  Operation,
  OperationDetailsParameters,
  OperationHistoryParameters,
  OperationHistoryResponse,
  YMFormPaymentType,
  YMPaymentFormBuilder,
} from 'yoomoney-sdk';

@Injectable()
export class YooMoneyClient {
  private readonly token: string;
  private readonly receiver: string;
  private readonly successURL: string;
  private yooMoney: API;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get('YOOMONEY_TOKEN');
    // If receiver is not explicitly set, we might need to derive it or it might be optional for some calls, 
    // but for the form builder it is required. 
    // The user's .env snippet didn't show YOOMONEY_WALLET, but showed YOOMONEY_TOKEN.
    // However, the previous code used YOOMONEY_WALLET. 
    // Let's assume YOOMONEY_WALLET is also in env or we should use the one from env.
    // If the user only provided TOKEN, SECRET, SUCCESS_URL, we might need to check if WALLET is there.
    // For now, I will update to use the standard names if they match what was likely intended or keep existing if they are different.
    // The user specifically pointed to YOOMONEY_TOKEN.

    this.receiver = this.configService.get('YOOMONEY_WALLET');
    this.successURL = this.configService.get('YOOMONEY_SUCCESS_URL') ||
      (this.configService.get('DOMAIN') + '/payment/yoomoney/success');

    this.yooMoney = new API(this.token);
  }

  generatePaymentForm(
    amount: number,
    paymentId: string,
    comment: string,
  ): string {
    const builder = new YMPaymentFormBuilder({
      quickPayForm: 'donate',
      sum: amount,
      successURL: this.successURL,
      paymentType: YMFormPaymentType.FromCard,
      receiver: this.receiver,
      label: paymentId,
      formComment: 'Пополнение OpenPNBot',
      targets: comment,
    });

    return builder.buildHtml();
  }

  async getOperationDetails(operationId: string): Promise<Operation> {
    const parameters: OperationDetailsParameters = {
      operation_id: operationId,
    };
    return await this.yooMoney.operationDetails(parameters);
  }

  async getOperationHistory(
    parameters?: OperationHistoryParameters,
  ): Promise<OperationHistoryResponse> {
    return this.yooMoney.operationHistory(parameters);
  }
}
