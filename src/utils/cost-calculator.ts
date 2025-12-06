import { ModelTariff } from '@prisma/client';

/**
 * Cost Calculation Utility
 * 
 * Shared logic for calculating generation costs based on ModelTariff.
 * Used by both CreditsService and test scripts.
 */

export interface SystemSettingsData {
    systemMargin: number;
    creditsPerUsd: number;
    usdRubRate: number;
}

export interface CostCalculationParams {
    model: ModelTariff;
    systemSettings: SystemSettingsData;
    userMargin: number;
    inputTokens: number;
    outputTokens: number;
    isImageGeneration?: boolean;
    isHighRes?: boolean;
    numberOfImages?: number;
}

export interface CostCalculationResult {
    baseCost: number;
    totalCostUsd: number;
    creditsToDeduct: number;
    costRub: number;
    details: {
        modelId: string;
        inputTokens: number;
        outputTokens: number;
        inputCost: number;
        outputCost: number;
        baseCost: number;
        margins: {
            system: number;
            user: number;
            model: number;
            totalPercent: number;
        };
        creditPriceUsd: number;
        creditsPerUsd: number;
    };
}

/**
 * Calculate the cost of a generation based on tokens and model tariff.
 * 
 * For image generation models (hasImageGeneration = true):
 * - Input cost: inputTokens × inputPrice (for text prompt)
 * - Input image cost: inputImageTokens × inputPrice (per input image)
 * - Output cost: Uses outputImagePrice if set, otherwise outputPrice × outputTokens
 * 
 * For text models:
 * - Input cost: inputTokens × inputPrice
 * - Output cost: outputTokens × outputPrice
 */
export function calculateGenerationCost(params: CostCalculationParams): CostCalculationResult {
    const {
        model,
        systemSettings,
        userMargin,
        inputTokens,
        outputTokens,
        isImageGeneration = false,
        numberOfImages = 1,
    } = params;

    // 1. Calculate Input Cost
    const inputCost = (inputTokens / 1_000_000) * (model.inputPrice || 0);

    // 2. Calculate Output Cost
    let outputCost: number;

    if (isImageGeneration && model.hasImageGeneration && model.outputImagePrice) {
        // For image generation: use outputImagePrice per 1M tokens
        outputCost = (outputTokens / 1_000_000) * model.outputImagePrice * numberOfImages;
    } else {
        // For text or fallback: use regular outputPrice
        outputCost = (outputTokens / 1_000_000) * (model.outputPrice || 0) * numberOfImages;
    }

    // 3. Base Cost
    const baseCost = inputCost + outputCost;

    // 4. Apply Margins (System + User + Model)
    const totalMarginPercent = systemSettings.systemMargin + userMargin + model.modelMargin;
    const totalCostUsd = baseCost * (1 + totalMarginPercent);

    // 5. Convert to Credits
    let creditPriceUsd = model.creditPriceUsd;
    if (!creditPriceUsd) {
        creditPriceUsd = 1 / systemSettings.creditsPerUsd;
    }
    const creditsToDeduct = totalCostUsd / creditPriceUsd;

    // 6. Convert to RUB
    const costRub = totalCostUsd * systemSettings.usdRubRate;

    return {
        baseCost,
        totalCostUsd,
        creditsToDeduct,
        costRub,
        details: {
            modelId: model.modelId,
            inputTokens,
            outputTokens,
            inputCost,
            outputCost,
            baseCost,
            margins: {
                system: systemSettings.systemMargin,
                user: userMargin,
                model: model.modelMargin,
                totalPercent: totalMarginPercent,
            },
            creditPriceUsd,
            creditsPerUsd: systemSettings.creditsPerUsd,
        },
    };
}

/**
 * Estimate tokens for image generation based on model tariff.
 */
export function estimateImageTokens(
    model: ModelTariff,
    isHighRes: boolean = false,
    numberOfInputImages: number = 0,
): { inputTokens: number; outputTokens: number } {
    // Input tokens: text prompt (~100) + input image tokens
    const promptTokens = 100;
    const inputImageTokens = (model.inputImageTokens || 258) * numberOfInputImages;
    const inputTokens = promptTokens + inputImageTokens;

    // Output tokens: based on resolution
    const outputTokens = isHighRes
        ? (model.imageTokensHighRes || model.imageTokensLowRes || 1000)
        : (model.imageTokensLowRes || 1000);

    return { inputTokens, outputTokens };
}

/**
 * Format cost result for logging/display.
 */
export function formatCostResult(result: CostCalculationResult): string {
    const { details, creditsToDeduct, totalCostUsd, costRub } = result;
    const marginPercent = (details.margins.totalPercent * 100).toFixed(1);

    return [
        `Base: $${result.baseCost.toFixed(6)}`,
        `+${marginPercent}% margin: $${totalCostUsd.toFixed(6)}`,
        `Credits: ${creditsToDeduct.toFixed(4)}`,
        `RUB: ₽${costRub.toFixed(4)}`,
    ].join(' | ');
}
