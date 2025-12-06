import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymentService } from './payment.service';

import { ConfigService } from '@nestjs/config';
import { YooMoneyClient } from '@app/yoomoney-client';
import { YooMoneyNotification } from '@app/yoomoney-client/types/notification.type';
import { CryptoHelper } from '../utils/crypto.helper';
import { PaymentSystemEnum } from './enum/payment-system.enum';

@Controller('/payment')
export class PaymentController {
  successRedirectUrl?: string;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly yooMoney: YooMoneyClient,
    private readonly configService: ConfigService,
  ) {
    this.successRedirectUrl = configService.get('payment.yoomoney.successUrl');
  }

  @Get('yoomoney/success')
  async success(
    @Query('paymentId') paymentId: string,
    @Res() res: Response
  ) {
    if (paymentId) {
      try {
        await this.paymentService.validatePayment(paymentId);
      } catch (e) {
        console.error('Failed to validate payment on success redirect:', e);
      }
    }
    return res.redirect(this.successRedirectUrl);
  }

  @Post('/yoomoney/notification')
  async yooMoneyWebHook(@Body() body: YooMoneyNotification) {
    const isValid = await this.paymentService.yooMoneyWebHook(body);

    if (isValid) {
      await this.paymentService.validatePayment(body.label);
      return { data: 'success' };
    } else {
      return { data: 'invalid' };
    }
  }

  @Get('init')
  async initPayment(
    @Query('userId') userId: string,
    @Query('chatId') chatId: string,
    @Query('tariffId') tariffId: string,
    @Query('timestamp') timestamp: string,
    @Query('sign') sign: string,
    @Res() res: Response,
  ) {
    // 1. Validate Signature
    const secret = this.configService.get('YOOMONEY_SECRET') || 'default_secret';
    const params = { userId, chatId, tariffId, timestamp };

    // Convert string inputs to numbers where expected by helper if strict, 
    // but helper takes string|number. However, query params are strings.
    // We must ensure the signing logic matches. 
    // In service: userId(number), chatId(number), tariffId(string), timestamp(number).
    // Here: all strings.
    // Let's cast them to match what was signed.

    const validationParams = {
      userId: Number(userId),
      chatId: Number(chatId),
      tariffId,
      timestamp: Number(timestamp),
    };

    if (!CryptoHelper.verifyParams(validationParams, sign, secret)) {
      return res.status(HttpStatus.FORBIDDEN).send('Invalid signature');
    }

    // 2. Create Payment
    try {
      // Assuming 'yoomoney' as default for this quick link
      // We need to import PaymentSystemEnum or use string 'YOOMONEY' if acceptable?
      // Service expects enum.

      const payment = await this.paymentService.createPayment(
        userId,
        tariffId,
        PaymentSystemEnum.YOOMONEY
      );

      // 3. Redirect to YooMoney
      // The payment object has .url which is the internal one we set in strategy?
      // Wait, in previous step we set strategy URL to `${DOMAIN}/payment/${paymentId}`.
      // But we want to go DIRECTLY to YooMoney here to save a click/redirect.
      // We can use yooMoneyClient.generatePaymentUrl again here? 
      // OR we can rely on what the strategy returns.

      // If strategy returns DOMAIN link, we are just redirecting to... ourselves? 
      // That defeats the purpose of "One Click" if it just shows the form page.
      // AH! "Web Handler" variant 1 described: "Server 'on the fly' creates payment and IMMEDIATELY REDIRECTS to YooMoney".

      // So we should NOT redirect to payment.url (which is the form page).
      // We should generate the raw YooMoney URL here.

      // We access the payment form/url data.
      // The strategy created the payment. 
      // If we use YooMoneyPaymentStrategy, it put `${DOMAIN}...` in .url.
      // But it didn't save the raw YooMoney link in .url.
      // HOWEVER, it saved `form`? No, we need the GET link.

      // Let's look at `payment.service.ts` -> `createPayment`.
      // It returns a `Payment` object (Prisma model).
      // Metadata has `payUrl`? No, we removed it? 
      // Let's check `metadata` in `PaymentService.createPayment`. 

      // In Step 111, I mistakenly put `url` in metadata. 
      // "url: paymentData._payment.url" -> this is the DOMAIN link now.

      // We need the RAW YooMoney link.
      // We can regenerate it here if we have the data.
      // Or we can modify the Strategy/Service to start saving the raw link in metadata again (e.g. as `providerUrl`).

      // For now, to avoid touching Strategy again:
      // We have `payment.amount`, `payment.paymentId`.
      // We accept `tariffId`.
      // We can just call `yooMoney.generatePaymentUrl(...)`.

      const comment = `Payment for ${payment.amount} credits, userId: ${userId}`;
      const quickPayUrl = this.yooMoney.generatePaymentUrl(payment.amount, payment.paymentId, comment);

      return res.redirect(quickPayUrl);

    } catch (e) {
      console.error(e);
      return res.status(HttpStatus.BAD_REQUEST).send('Error creating payment');
    }
  }

  @Get(':paymentId')
  @Header('content-type', 'text/html')
  async getPayment(@Param('paymentId') paymentId: string): Promise<string> {
    return this.paymentService.getPaymentForm(paymentId);
  }
}
