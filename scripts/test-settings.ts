import { PrismaClient } from '../bananabot-admin/node_modules/.prisma/client';
import { CreditsService } from '../src/credits/credits.service';
import { UserService } from '../src/user/user.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { ConfigService } from '@nestjs/config';

async function main() {
    console.log('Starting settings verification...');

    const prisma = new PrismaClient();

    // 1. Update System Settings
    console.log('Updating System Settings...');
    await prisma.systemSettings.upsert({
        where: { key: 'singleton' },
        update: {
            freeCreditsAmount: 10,
            creditsPerUsd: 50, // $1 = 50 credits => 1 credit = $0.02
        },
        create: {
            key: 'singleton',
            freeCreditsAmount: 10,
            creditsPerUsd: 50,
        },
    });

    // 2. Mock NestJS Services
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            UserService,
            CreditsService,
            {
                provide: PrismaService,
                useValue: prisma,
            },
            {
                provide: ConfigService,
                useValue: { get: () => 'dummy' },
            },
        ],
    }).compile();

    const userService = module.get<UserService>(UserService);
    const creditsService = module.get<CreditsService>(CreditsService);

    // 3. Test User Registration (Free Credits)
    console.log('Testing User Registration...');
    const telegramId = BigInt(Date.now());
    const user = await userService.upsert({
        telegramId,
        firstName: 'Test Settings User',
    });

    console.log(`User created with credits: ${user.credits}`);
    if (user.credits === 10) {
        console.log('SUCCESS: Free credits amount respected.');
    } else {
        console.error(`FAILURE: Expected 10 credits, got ${user.credits}`);
    }

    // 4. Test Cost Calculation (Credits per USD)
    console.log('Testing Cost Calculation...');
    // Create a dummy model tariff without explicit credit price
    const modelId = `test-model-${Date.now()}`;
    await prisma.modelTariff.create({
        data: {
            modelId,
            name: 'Test Model',
            inputPrice: 10, // $10 per 1M tokens
            outputPrice: 10,
            creditPriceUsd: null, // Should use global setting
            provider: {
                connectOrCreate: {
                    where: { slug: 'google' },
                    create: { slug: 'google', name: 'Google', authType: 'API_KEY' }
                }
            }
        },
    });

    // Calculate cost for 1M tokens (should be $10 + $10 = $20)
    // With creditsPerUsd = 50, $20 = 1000 credits
    const cost = await creditsService.calculateTokenCost(modelId, 1_000_000, 1_000_000, user.id);

    console.log(`Total Cost USD: ${cost.totalCostUsd}`);
    console.log(`Credits to Deduct: ${cost.creditsToDeduct}`);

    // Base cost $20. Margins might apply.
    // Assuming 0 margins for simplicity in this test user/system
    // If margins exist, cost will be higher.
    // But we mainly check if conversion rate is applied.

    // Expected credit price = 1 / 50 = 0.02
    // Credits = Cost / 0.02 = Cost * 50

    const expectedCredits = cost.totalCostUsd * 50;

    if (Math.abs(cost.creditsToDeduct - expectedCredits) < 0.01) {
        console.log('SUCCESS: Global exchange rate applied correctly.');
    } else {
        console.error(`FAILURE: Expected ~${expectedCredits}, got ${cost.creditsToDeduct}`);
    }

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.modelTariff.delete({ where: { modelId } });
    await prisma.$disconnect();
}

main().catch(console.error);
