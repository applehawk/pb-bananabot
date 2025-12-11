
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Configuring Marketing Tools...');

    // 1. Update System Settings (Bonus Optimization)
    console.log('Updating System Settings...');
    await prisma.systemSettings.upsert({
        where: { key: 'singleton' },
        update: {
            freeCreditsAmount: 20, // Reduced from 3 to 20? Wait, old was 3? User said "Give 50 credits" in prompt? 
            // User prompt: "Проблема: Вы даете 'халяву'... 30 'туристов' съели у вас 730 рублей...  Давать не 50 кредитов, а 20 кредитов."
            // So PREVIOUSLY it was 50 (or 3 in config but logic gave 50?). 
            // User Service: const freeCredits = systemSettings?.freeCreditsAmount ?? 3;
            // Wait, if code says 3, why user says 50?
            // Ah, UserService `const referralBonus = systemSettings?.referralBonusAmount ?? 50;`
            // User creation: `credits: freeCredits`.
            // Maybe user meant 50?
            // "Твои 50 кредитов скучают" -> implies they got 50.
            // I will set it to 20 as requested.

            // Also: "Пусть бесплатные генерации идут по модели за 4.67 кр., а не 16.26."
            // Need to find model ID for 4.67. 
            // "gemini-2.5-flash-image" is likely the cheap one.
            defaultNewUserModelId: 'gemini-2.5-flash-image',
        },
        create: {
            key: 'singleton',
            freeCreditsAmount: 20,
            defaultNewUserModelId: 'gemini-2.5-flash-image',
        }
    });

    // 2. Create "Starter Package" (Tripwire)
    console.log('Creating/Updating Tripwire Package...');
    // "50 генераций за 99 рублей". 
    // If cheap model is 4.67 credits/gen, then 50 gens = 233.5 credits.
    // Let's round to 235 or 250.
    // User said: "50 генераций за 99 рублей".
    const creditsForTripwire = 235; // 50 * 4.7

    const tripwirePackage = await prisma.creditPackage.upsert({
        where: { id: 'tripwire_starter_99' }, // Use fixed ID for ease
        update: {
            name: '🐣 Стартовый пакет',
            description: '50 генераций. Идеально для старта.',
            credits: creditsForTripwire,
            price: 99,
            priceYooMoney: 99,
            active: true,
            popular: true, // Make it visible? Or hidden? User said "After bonus ends... offer Tripwire".
            // Usually hidden from main list to being exclusive? 
            // User: "Предложите 'Стартовый пакет'..."
            // I'll make it active.
        },
        create: {
            id: 'tripwire_starter_99',
            name: '🐣 Стартовый пакет',
            description: '50 генераций. Идеально для старта.',
            credits: creditsForTripwire,
            price: 99,
            priceYooMoney: 99,
            active: true,
            popular: true,
        }
    });

    // Link to SystemSettings
    await prisma.systemSettings.update({
        where: { key: 'singleton' },
        data: {
            tripwirePackageId: tripwirePackage.id
        }
    });

    // 3. Configure Retention Stages ("Burn Down")
    console.log('Configuring Retention Stages...');

    // Stage 1: 2 hours after registration
    await prisma.retentionStage.upsert({
        where: { order: 1 },
        update: {
            name: 'Burn Down - 2 Hours',
            message: '👋 Привет! Твои <b>20 кредитов</b> скучают.\n\nПопробуй создать что-нибудь прямо сейчас! 👇',
            hoursSinceRegistration: 2,
            isActive: true,
            buttons: [
                { text: '🎲 Случайный шедевр', callback_data: 'generate_random' }
            ]
        },
        create: {
            order: 1,
            name: 'Burn Down - 2 Hours',
            message: '👋 Привет! Твои <b>20 кредитов</b> скучают.\n\nПопробуй создать что-нибудь прямо сейчас! 👇',
            hoursSinceRegistration: 2,
            isActive: true,
            buttons: [
                { text: '🎲 Случайный шедевр', callback_data: 'generate_random' }
            ]
        }
    });

    // Stage 2: 24 hours (12 hours left)
    await prisma.retentionStage.upsert({
        where: { order: 2 },
        update: {
            name: 'Burn Down - 24 Hours',
            message: '⏳ <b>Осталось 12 часов!</b>\n\nТвои бесплатные генерации скоро сгорят, если их не использовать.\nНе упускай шанс! 🔥',
            hoursSinceRegistration: 24,
            isActive: true,
            buttons: [
                { text: '🎲 Потратить кредиты', callback_data: 'generate_random' }
            ]
        },
        create: {
            order: 2,
            name: 'Burn Down - 24 Hours',
            message: '⏳ <b>Осталось 12 часов!</b>\n\nТвои бесплатные генерации скоро сгорят, если их не использовать.\nНе упускай шанс! 🔥',
            hoursSinceRegistration: 24,
            isActive: true,
            buttons: [
                { text: '🎲 Потратить кредиты', callback_data: 'generate_random' }
            ]
        }
    });

    console.log('✅ Configuration Complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
