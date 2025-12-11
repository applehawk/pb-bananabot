import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { DatabaseModule } from '../database/database.module';
import { GrammYModule } from '../grammy/grammy.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from '../payment/payment.module';

@Module({
    imports: [DatabaseModule, GrammYModule, ConfigModule, PaymentModule],
    providers: [RetentionService],
    exports: [RetentionService],
})
export class RetentionModule { }
