import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env from', envPath);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

// Fallback for local testing if DATABASE_URL is missing or uses docker host
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('@postgres:')) {
    console.log('Using fallback localhost DATABASE_URL');
    process.env.DATABASE_URL = 'postgresql://bananabot:bananabot_secret@localhost:5432/bananabot?schema=public';
}

console.log('DEBUG: DATABASE_URL is', process.env.DATABASE_URL);

import { prisma } from '../src/lib/prisma';
import { calculateFinalPrice } from '../src/utils/pricing.utils';

async function main() {
    console.log('🚀 Starting pricing test...');

    // 1. Create Provider
    const provider = await prisma.provider.upsert({
        where: { slug: 'test-provider' },
        update: {},
        create: {
            slug: 'test-provider',
            name: 'Test Provider',
            authType: 'API_KEY',
        },
    });

    // 2. Create ModelTariff (Text)
    const textModel = await prisma.modelTariff.upsert({
        where: { modelId: 'test-text-model' },
        update: {
            inputPrice: 1.0, // $1 per 1M tokens
            outputPrice: 2.0, // $2 per 1M tokens
            priceUnit: 'per_million_tokens',
            modelMargin: 0.1, // +10%
        },
        create: {
            modelId: 'test-text-model',
            providerId: provider.id,
            name: 'Test Text Model',
            inputPrice: 1.0,
            outputPrice: 2.0,
            priceUnit: 'per_million_tokens',
            modelMargin: 0.1,
        },
    });

    // 3. Create ModelTariff (Video per second)
    const videoModel = await prisma.modelTariff.upsert({
        where: { modelId: 'test-video-model' },
        update: {
            outputVideoPrice: 0.1, // $0.10 per second
            priceUnit: 'per_second',
            modelMargin: 0.2, // +20%
        },
        create: {
            modelId: 'test-video-model',
            providerId: provider.id,
            name: 'Test Video Model',
            outputVideoPrice: 0.1,
            priceUnit: 'per_second',
            modelMargin: 0.2,
        },
    });

    // 4. Update System Settings
    await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { systemMargin: 0.05 }, // +5%
        create: { id: 'singleton', key: 'default', systemMargin: 0.05 },
    });

    // 5. Test Calculation: Text
    console.log('\n🧪 Testing Text Model...');
    const textResult = await calculateFinalPrice('test-text-model', {
        promptTokens: 1_000_000, // Should be $1 cost
        outputTokens: 1_000_000, // Should be $2 cost
    });
    // Cost = 1 + 2 = $3
    // Margin = 5% (sys) + 10% (model) = 15%
    // Price = 3 * 1.15 = 3.45
    console.log('Text Result:', textResult);

    if (textResult.costUsd === 3 && textResult.priceUsd === 3.45) {
        console.log('✅ Text Model Test Passed');
    } else {
        console.error('❌ Text Model Test Failed');
    }

    // 6. Test Calculation: Video
    console.log('\n🧪 Testing Video Model...');
    const videoResult = await calculateFinalPrice('test-video-model', {
        videoSeconds: 10, // 10 * 0.1 = $1 cost
    });
    // Cost = 1
    // Margin = 5% (sys) + 20% (model) = 25%
    // Price = 1 * 1.25 = 1.25
    console.log('Video Result:', videoResult);

    if (videoResult.costUsd === 1 && videoResult.priceUsd === 1.25) {
        console.log('✅ Video Model Test Passed');
    } else {
        console.error('❌ Video Model Test Failed');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
