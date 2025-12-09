import { Module, Global, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GenerationProcessor } from './processors/generation.processor';
import { GenerationModule } from '../generation/generation.module';
import { GrammYModule } from '../grammy/grammy.module';

@Global()
@Module({
    imports: [
        ConfigModule,
        forwardRef(() => GrammYModule),
        forwardRef(() => GenerationModule),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    url: configService.get('REDIS_URL'),
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: 'generation',
        }),
    ],
    providers: [GenerationProcessor],
    exports: [BullModule],
})
export class QueueModule { }