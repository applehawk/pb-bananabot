import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  API,
  Operation,
  OperationDetailsParameters,
  OperationHistoryParameters,
  OperationHistoryResponse,
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
    // Manually build the form to ensure correct parameters and URL
    // https://yoomoney.ru/docs/payment-buttons/using-api/forms

    if (!this.receiver) {
      throw new Error('YOOMONEY_WALLET is not defined in environment variables');
    }

    // Check if successURL already has query params
    const hasQuery = this.successURL.includes('?');
    const successUrlWithReturn = `${this.successURL}${hasQuery ? '&' : '?'}paymentId=${paymentId}&client=1`;

    const formFields = {
      receiver: this.receiver,
      'quickpay-form': 'button',
      paymentType: 'AC', // Bank card by default
      sum: amount.toString(),
      label: paymentId,
      targets: comment,
      formcomment: 'Пополнение BaniBani AI',
      successURL: successUrlWithReturn,
      'need-fio': 'false',
      'need-email': 'false',
      'need-phone': 'false',
      'need-address': 'false',
    };

    const inputs = Object.entries(formFields)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join('\n');

    const formId = `form_${paymentId}`;

    return `
      <form method="POST" action="https://yoomoney.ru/quickpay/confirm" id="${formId}">
        ${inputs}
      </form>
      <script>
        (function() {
          document.getElementById('${formId}').submit();
        })();
      </script>
    `.trim();
  }

  generatePaymentUrl(
    amount: number,
    paymentId: string,
    comment: string,
  ): string {
    // Check if successURL already has query params
    const hasQuery = this.successURL.includes('?');
    const successUrlWithReturn = `${this.successURL}${hasQuery ? '&' : '?'}paymentId=${paymentId}&client=1`;

    // Generate direct URL for QuickPay
    // https://yoomoney.ru/quickpay/confirm.xml?receiver=...&quickpay-form=donate&targets=...&sum=...
    const params = new URLSearchParams({
      receiver: this.receiver,
      'quickpay-form': 'donate',
      targets: comment,
      paymentType: 'AC', // Bank card
      sum: amount.toString(),
      label: paymentId,
      successURL: successUrlWithReturn,
    });

    return `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;
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
