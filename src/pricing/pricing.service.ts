import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ModelTariff, Provider } from '@prisma/client';

@Injectable()
export class PricingService {
    constructor(private readonly prisma: PrismaService) { }

    async calculateFinalPrice(
        modelId: string,
        params: {
            promptTokens?: number;
            outputTokens?: number;
            imageCount?: number;
            videoSeconds?: number;
            audioMinutes?: number;
        },
        userId?: string
    ): Promise<{ costUsd: number; priceUsd: number; margin: number }> {
        const tariff = await this.prisma.modelTariff.findUnique({
            where: { modelId },
            include: { provider: true },
        });

        if (!tariff) throw new Error(`Model tariff not found for modelId: ${modelId}`);

        // Fetch system settings for system margin
        const systemSettings = await this.prisma.systemSettings.findUnique({
            where: { id: 'singleton' },
        });
        const systemMargin = systemSettings?.systemMargin ?? 0;

        let userMargin = 0;
        if (userId) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { personalMargin: true },
            });
            userMargin = user?.personalMargin ?? 0;
        }

        let costUsd = 0;

        // 1. Text / Multimodal
        if (tariff.priceUnit === 'per_million_tokens' || !tariff.priceUnit) {
            const inputTokens = params.promptTokens ?? 0;
            const outputTokens = params.outputTokens ?? 0;

            const inputPrice =
                (inputTokens / 1_000_000) *
                (tariff.inputLongPrice ?? tariff.inputPrice ?? 0);
            const outputPrice =
                (outputTokens / 1_000_000) *
                (tariff.outputLongPrice ?? tariff.outputPrice ?? 0);

            // Image generation via tokens
            const imageGenTokens =
                (params.imageCount ?? 0) *
                (tariff.imageTokensHighRes ?? tariff.imageTokensLowRes ?? 1120);
            const imagePrice =
                (imageGenTokens / 1_000_000) *
                (tariff.outputImagePrice ?? tariff.outputPrice ?? 0);

            costUsd = inputPrice + outputPrice + imagePrice;
        }

        // 2. Video per second
        if (
            params.videoSeconds &&
            tariff.outputVideoPrice &&
            tariff.priceUnit === 'per_second'
        ) {
            costUsd = params.videoSeconds * tariff.outputVideoPrice;
        }

        // 3. Video per credits
        if (params.videoSeconds && tariff.creditsPerSecond) {
            const creditsUsed = params.videoSeconds * tariff.creditsPerSecond;
            const creditPrice = tariff.creditPriceUsd ?? 0.01;
            costUsd = creditsUsed * creditPrice;
        }

        // 4. Audio
        if (params.audioMinutes && tariff.outputAudioPrice) {
            costUsd += params.audioMinutes * tariff.outputAudioPrice;
        }

        // Round cost to 6 decimal places
        costUsd = Math.round(costUsd * 1e6) / 1e6;

        // Calculate Margins
        const modelMargin = tariff.modelMargin ?? 0;
        const totalMarginPercent = systemMargin + modelMargin + userMargin;
        const marginMultiplier = 1 + totalMarginPercent;

        let priceUsd = costUsd * marginMultiplier;

        // Round up to 2 decimal places (cents)
        priceUsd = Math.ceil(priceUsd * 100) / 100;

        return {
            costUsd,
            priceUsd,
            margin: priceUsd - costUsd,
        };
    }
}
