import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env from root
config({ path: resolve(__dirname, '../.env') });

// Fallback for DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public';
    console.log('⚠️  Using fallback DATABASE_URL for local development');
}


const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Seeding Google Gemini models...');

    // Create or update Provider
    const provider = await prisma.provider.upsert({
        where: { slug: 'google-gemini' },
        update: {
            name: 'Google Gemini API',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            authType: 'X_API_KEY',
            authHeaderName: 'x-goog-api-key',
        },
        create: {
            slug: 'google-gemini',
            name: 'Google Gemini API',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            authType: 'X_API_KEY',
            authHeaderName: 'x-goog-api-key',
        },
    });

    console.log(`✅ Provider created/updated: ${provider.name}`);

    // Define models with their pricing
    const models = [
        // TEXT MODELS
        {
            modelId: 'gemini-3-pro-preview',
            name: 'Gemini 3 Pro Preview',
            description: 'The best model in the world for multimodal understanding, and most powerful agentic model yet.',
            inputPrice: 1.25,
            outputPrice: 6.25,
            inputLongPrice: null, // Long context pricing
            outputLongPrice: null,
            priceUnit: 'per_million_tokens',
            maxTokens: 128000,
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: true,
            modelNameOnProvider: 'gemini-3-pro-preview',
        },
        {
            modelId: 'gemini-2.5-pro',
            name: 'Gemini 2.5 Pro',
            description: 'State-of-the-art multipurpose model, excels at coding and complex reasoning tasks.',
            inputPrice: 1.25,
            outputPrice: 6.25,
            inputLongPrice: null,
            outputLongPrice: null,
            priceUnit: 'per_million_tokens',
            maxTokens: 2097152, // 2M context
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: false,
            modelNameOnProvider: 'gemini-2.5-pro',
        },
        {
            modelId: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            description: 'First hybrid reasoning model with 1M token context window and thinking budgets.',
            inputPrice: 0.15,
            outputPrice: 0.90,
            inputLongPrice: null,
            outputLongPrice: null,
            priceUnit: 'per_million_tokens',
            maxTokens: 1048576, // 1M context
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: false,
            modelNameOnProvider: 'gemini-2.5-flash',
        },
        {
            modelId: 'gemini-2.5-flash-preview',
            name: 'Gemini 2.5 Flash Preview',
            description: 'Preview version of Gemini 2.5 Flash with latest features.',
            inputPrice: 0.20,
            outputPrice: 1.00,
            inputLongPrice: null,
            outputLongPrice: null,
            priceUnit: 'per_million_tokens',
            maxTokens: 1048576,
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: true,
            modelNameOnProvider: 'gemini-2.5-flash-preview',
        },
        {
            modelId: 'gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            description: 'Fast and efficient model for quick responses.',
            inputPrice: 0.30,
            outputPrice: 1.20,
            inputLongPrice: null,
            outputLongPrice: null,
            priceUnit: 'per_million_tokens',
            maxTokens: 1048576,
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: false,
            modelNameOnProvider: 'gemini-2.0-flash',
        },

        // IMAGE GENERATION MODELS
        {
            modelId: 'gemini-3-pro-image-preview',
            name: 'Gemini 3 Pro Image Preview',
            description: 'Native image generation model optimized for speed, flexibility, and contextual understanding.',
            inputPrice: 2.00, // Text/image input
            outputPrice: 12.00, // Text output
            outputImagePrice: 120.00, // Image generation
            priceUnit: 'per_million_tokens',
            imageTokensLowRes: 1120, // 1K/2K resolution
            imageTokensHighRes: 2000, // 4K resolution
            maxTokens: 128000,
            maxImageResolution: '4096x4096',
            supportedResolutions: ['1024x1024', '1024x2048', '2048x1024', '2048x2048', '4096x4096'],
            hasImageGeneration: true,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: true,
            modelNameOnProvider: 'gemini-3-pro-image-preview',
        },
        {
            modelId: 'gemini-2.5-flash-image',
            name: 'Gemini 2.5 Flash Image',
            description: 'Native image generation optimized for speed. Text pricing same as 2.5 Flash.',
            inputPrice: 0.30, // Text/image input
            outputPrice: 30.00, // Image generation (per 1M tokens)
            priceUnit: 'per_million_tokens',
            imageTokensLowRes: 1290, // 1024x1024
            imageTokensHighRes: 1290, // Same for all resolutions
            maxTokens: 1048576,
            maxImageResolution: '1024x1024',
            supportedResolutions: ['1024x1024'],
            hasImageGeneration: true,
            hasVideoGeneration: false,
            hasNativeAudio: false,
            isPreview: false,
            modelNameOnProvider: 'gemini-2.5-flash-image',
        },

        // AUDIO MODELS
        {
            modelId: 'gemini-2.5-flash-native-audio-preview',
            name: 'Gemini 2.5 Flash Native Audio (Live API)',
            description: 'Live API native audio model optimized for higher quality audio outputs.',
            inputPrice: 0.35, // Text
            outputPrice: 1.50, // Text
            outputAudioPrice: 8.50, // Audio per minute (converted from per 1M tokens)
            priceUnit: 'per_million_tokens',
            maxTokens: 1048576,
            hasImageGeneration: false,
            hasVideoGeneration: false,
            hasNativeAudio: true,
            isPreview: true,
            modelNameOnProvider: 'gemini-2.5-flash-native-audio-preview-09-2025',
        },
    ];

    // Insert or update models
    for (const model of models) {
        try {
            const tariff = await prisma.modelTariff.upsert({
                where: { modelId: model.modelId },
                update: {
                    ...model,
                    providerId: provider.id,
                    isActive: true,
                    updatedAt: new Date(),
                },
                create: {
                    ...model,
                    providerId: provider.id,
                    isActive: true,
                    modelMargin: 0, // Default no margin
                },
            });
            console.log(`  ✅ ${tariff.name} (${tariff.modelId})`);
        } catch (error) {
            console.error(`  ❌ Failed to create ${model.modelId}:`, error);
        }
    }

    console.log('\\n🎉 Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
