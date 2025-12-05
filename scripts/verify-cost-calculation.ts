/**
 * Cost Calculation Verification Script
 * 
 * Uses the same cost calculation logic as the bot (src/utils/cost-calculator.ts)
 * 
 * Usage:
 *   npx tsx scripts/verify-cost-calculation.ts [model1] [model2] ...
 */

import { PrismaClient } from '@prisma/client';
import {
    calculateGenerationCost,
    estimateImageTokens,
    formatCostResult,
    type ModelTariffData,
    type SystemSettingsData,
} from '../src/utils/cost-calculator';

const prisma = new PrismaClient();

const DEFAULT_MODELS = [
    'gemini-2.5-flash-image',
    'gemini-3-pro-image-preview',
];

async function testModel(
    modelId: string,
    systemSettings: SystemSettingsData,
    userMargin: number = 0,
) {
    const model = await prisma.modelTariff.findUnique({
        where: { modelId },
    });

    if (!model) {
        console.log(`\n❌ Model not found: ${modelId}`);
        return null;
    }

    const modelData: ModelTariffData = {
        modelId: model.modelId,
        inputPrice: model.inputPrice,
        outputPrice: model.outputPrice,
        outputImagePrice: model.outputImagePrice,
        modelMargin: model.modelMargin,
        creditPriceUsd: model.creditPriceUsd,
        hasImageGeneration: model.hasImageGeneration,
        inputImageTokens: model.inputImageTokens,
        imageTokensLowRes: model.imageTokensLowRes,
        imageTokensHighRes: model.imageTokensHighRes,
    };

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`MODEL: ${model.name}`);
    console.log(`ID: ${model.modelId}`);
    console.log(`${'═'.repeat(60)}`);

    // Tariff info
    console.log(`\n📋 TARIFF`);
    console.log(`  Input Price:       $${model.inputPrice} per 1M tokens`);
    console.log(`  Output Price:      $${model.outputPrice} per 1M tokens`);
    console.log(`  Output Image Price: ${model.outputImagePrice ? `$${model.outputImagePrice} per 1M tokens` : 'N/A (uses outputPrice)'}`);
    console.log(`  Input Image Tokens: ${model.inputImageTokens || 'N/A'}`);
    console.log(`  Image Tokens (Low): ${model.imageTokensLowRes || 'N/A'}`);
    console.log(`  Image Tokens (High): ${model.imageTokensHighRes || 'N/A'}`);
    console.log(`  Has Image Gen:     ${model.hasImageGeneration ? 'Yes' : 'No'}`);

    // Margins
    console.log(`\n💰 MARGINS`);
    console.log(`  System Margin: ${(systemSettings.systemMargin * 100).toFixed(1)}%`);
    console.log(`  Model Margin:  ${(model.modelMargin * 100).toFixed(1)}%`);
    console.log(`  User Margin:   ${(userMargin * 100).toFixed(1)}%`);
    console.log(`  ─────────────────────`);
    const totalMargin = systemSettings.systemMargin + model.modelMargin + userMargin;
    console.log(`  TOTAL Margin:  ${(totalMargin * 100).toFixed(1)}%`);

    // Estimate tokens for image generation
    const { inputTokens, outputTokens } = estimateImageTokens(modelData, false, 0);

    console.log(`\n📊 CALCULATION (Text-to-Image, Low Res)`);
    console.log(`  Estimated Tokens: ${inputTokens} in / ${outputTokens} out`);

    // Calculate WITHOUT margins
    const resultNoMargin = calculateGenerationCost({
        model: modelData,
        systemSettings: { ...systemSettings, systemMargin: 0 },
        userMargin: 0,
        inputTokens,
        outputTokens,
        isImageGeneration: model.hasImageGeneration,
    });

    // Calculate WITH margins
    const resultWithMargin = calculateGenerationCost({
        model: modelData,
        systemSettings,
        userMargin,
        inputTokens,
        outputTokens,
        isImageGeneration: model.hasImageGeneration,
    });

    // Display
    console.log(`\n  ┌────────────────────────────────────────────────────────┐`);
    console.log(`  │  BASE COST (no margins)                                │`);
    console.log(`  ├────────────────────────────────────────────────────────┤`);
    console.log(`  │  Input:   ${inputTokens} × $${model.inputPrice}/1M = $${resultNoMargin.details.inputCost.toFixed(8).padEnd(12)}  │`);
    const priceUsed = model.hasImageGeneration && model.outputImagePrice ? model.outputImagePrice : model.outputPrice;
    console.log(`  │  Output:  ${outputTokens} × $${priceUsed}/1M = $${resultNoMargin.details.outputCost.toFixed(8).padEnd(12)} │`);
    console.log(`  │  ──────────────────────────────────────────────────    │`);
    console.log(`  │  USD:     $${resultNoMargin.baseCost.toFixed(8).padEnd(12)}                        │`);
    console.log(`  │  Credits: ${resultNoMargin.creditsToDeduct.toFixed(4).padEnd(12)} (at ${systemSettings.creditsPerUsd} cr/$)         │`);
    console.log(`  │  RUB:     ₽${resultNoMargin.costRub.toFixed(4).padEnd(12)}                        │`);
    console.log(`  └────────────────────────────────────────────────────────┘`);

    console.log(`\n  ┌────────────────────────────────────────────────────────┐`);
    console.log(`  │  WITH MARGINS (+${(totalMargin * 100).toFixed(1)}%)                                │`);
    console.log(`  ├────────────────────────────────────────────────────────┤`);
    console.log(`  │  System: +${(systemSettings.systemMargin * 100).toFixed(1)}%  Model: +${(model.modelMargin * 100).toFixed(1)}%  User: +${(userMargin * 100).toFixed(1)}%        │`);
    console.log(`  │  ──────────────────────────────────────────────────    │`);
    console.log(`  │  USD:     $${resultWithMargin.totalCostUsd.toFixed(8).padEnd(12)}                        │`);
    console.log(`  │  Credits: ${resultWithMargin.creditsToDeduct.toFixed(4).padEnd(12)} (at ${systemSettings.creditsPerUsd} cr/$)         │`);
    console.log(`  │  RUB:     ₽${resultWithMargin.costRub.toFixed(4).padEnd(12)}                        │`);
    console.log(`  └────────────────────────────────────────────────────────┘`);

    return {
        modelId,
        modelName: model.name || modelId,
        inputTokens,
        outputTokens,
        noMargin: resultNoMargin,
        withMargin: resultWithMargin,
    };
}

async function main() {
    const args = process.argv.slice(2);
    const modelsToTest = args.length > 0 ? args : DEFAULT_MODELS;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     COST CALCULATION VERIFICATION (Shared Logic)          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // System Settings
    console.log('\n🔧 SYSTEM SETTINGS');
    const systemSettingsRaw = await prisma.systemSettings.findUnique({
        where: { key: 'singleton' },
    });

    const systemSettings: SystemSettingsData = {
        systemMargin: systemSettingsRaw?.systemMargin || 0,
        creditsPerUsd: systemSettingsRaw?.creditsPerUsd || 100,
        usdRubRate: systemSettingsRaw?.usdRubRate || 100,
    };

    console.log(`  System Margin:  ${(systemSettings.systemMargin * 100).toFixed(1)}%`);
    console.log(`  Credits/USD:    ${systemSettings.creditsPerUsd}`);
    console.log(`  USD/RUB Rate:   ${systemSettings.usdRubRate}`);

    const userMargin = 0; // Test with 0% user margin

    console.log(`\n📝 TEST PARAMETERS`);
    console.log(`  User Margin: ${(userMargin * 100).toFixed(1)}%`);
    console.log(`  Models: ${modelsToTest.join(', ')}`);

    // Test models
    const results = [];
    for (const modelId of modelsToTest) {
        const result = await testModel(modelId, systemSettings, userMargin);
        if (result) {
            results.push(result);
        }
    }

    // Comparison
    if (results.length > 1) {
        console.log('\n' + '═'.repeat(60));
        console.log('COMPARISON SUMMARY');
        console.log('═'.repeat(60));

        console.log(`\n${'Model'.padEnd(25)} ${'Tokens'.padStart(10)} ${'No Marg'.padStart(10)} ${'W/Margin'.padStart(10)} ${'Diff'.padStart(8)}`);
        console.log('─'.repeat(65));

        for (const r of results) {
            const diff = r.withMargin.creditsToDeduct - r.noMargin.creditsToDeduct;
            console.log(
                `${r.modelName.substring(0, 23).padEnd(25)} ${r.outputTokens.toString().padStart(10)} ${r.noMargin.creditsToDeduct.toFixed(4).padStart(10)} ${r.withMargin.creditsToDeduct.toFixed(4).padStart(10)} +${diff.toFixed(4).padStart(7)}`
            );
        }

        if (results.length === 2) {
            const ratio = results[1].withMargin.creditsToDeduct / results[0].withMargin.creditsToDeduct;
            console.log(`\n📊 ${results[1].modelName} is ${ratio.toFixed(2)}x more expensive than ${results[0].modelName}`);
        }
    }

    // Formula
    console.log('\n' + '─'.repeat(60));
    console.log('FORMULA (from src/utils/cost-calculator.ts)');
    console.log('  inputCost  = inputTokens / 1M × inputPrice');
    console.log('  outputCost = outputTokens / 1M × outputImagePrice (or outputPrice)');
    console.log('  baseCost   = inputCost + outputCost');
    console.log('  totalCost  = baseCost × (1 + systemMargin + modelMargin + userMargin)');
    console.log('  credits    = totalCost / creditPriceUsd');
    console.log(`  creditPriceUsd = 1 / ${systemSettings.creditsPerUsd} = $${(1 / systemSettings.creditsPerUsd).toFixed(6)}`);
    console.log('═'.repeat(60));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
