import { Body, Controller, Get, Header, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { PaymentService } from './payment.service';

import { ConfigService } from '@nestjs/config';
import { YooMoneyClient } from '@app/yoomoney-client';
import { YooMoneyNotification } from '@app/yoomoney-client/types/notification.type';

@Controller('/payment')
export class PaymentController {
    botUrl?: string

    constructor(private readonly paymentService: PaymentService,
        private readonly yooMoney: YooMoneyClient,
        private readonly configService: ConfigService) {
            this.botUrl = configService.get("BOT_URL");
        }

    @Get('yoomoney/success')
    success(@Res() res: Response) {
        return res.redirect(this.botUrl);
        //return { data: 'success' };
    }

    @Post('/yoomoney/notification')
    async yooMoneyWebHook(@Body() body: YooMoneyNotification) {
        const isValid = await this.paymentService.yooMoneyWebHook(body);

        if (isValid) {
            return { data: 'success' };
        } else {
            return { data: 'invalid' };
        }
    }

    @Get(':paymentId')
    @Header('content-type', 'text/html')
    async getPayment(@Param('paymentId') paymentId: string): Promise<string> {
        return this.paymentService.getPaymentForm(paymentId);
    }
}
