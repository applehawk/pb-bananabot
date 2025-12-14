
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum FSMStateCode {
    NEW = 'NEW',
    STARTED = 'STARTED',
    DEAD = 'DEAD',
    FIRST_GENERATION = 'FIRST_GENERATION',
    EARLY_EXPERIMENTER = 'EARLY_EXPERIMENTER',
    ACTIVE_FREE = 'ACTIVE_FREE',
    LOW_BALANCE_FREE = 'LOW_BALANCE_FREE',
    FREE_EXHAUSTED = 'FREE_EXHAUSTED',
    FREELOADER_EXPERIMENTER = 'FREELoader_EXPERIMENTER',
    TRIPWIRE_ELIGIBLE = 'TRIPWIRE_ELIGIBLE',
    TRIPWIRE_OFFERED = 'TRIPWIRE_OFFERED',
    TRIPWIRE_EXPIRED = 'TRIPWIRE_EXPIRED',
    PAYMENT_CLICKED = 'PAYMENT_CLICKED',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    PAID_ACTIVE = 'PAID_ACTIVE',
    PAID_LOW_BALANCE = 'PAID_LOW_BALANCE',
    PAID_EXHAUSTED = 'PAID_EXHAUSTED',
    BURNABLE_BONUS_ACTIVE = 'BURNABLE_BONUS_ACTIVE',
    BURNABLE_BONUS_EXPIRING = 'BURNABLE_BONUS_EXPIRING',
    BURNABLE_BONUS_EXPIRED = 'BURNABLE_BONUS_EXPIRED',
    SPECIAL_OFFER_SHOWN = 'SPECIAL_OFFER_SHOWN',
    SPECIAL_OFFER_EXPIRED = 'SPECIAL_OFFER_EXPIRED',
    REFERRAL_ELIGIBLE = 'REFERRAL_ELIGIBLE',
    REFERRAL_ACTIVE = 'REFERRAL_ACTIVE',
    REFERRAL_REWARDED = 'REFERRAL_REWARDED',
    REFERRAL_PAID_REWARDED = 'REFERRAL_PAID_REWARDED',
    INACTIVE_FREE = 'INACTIVE_FREE',
    INACTIVE_PAID = 'INACTIVE_PAID',
    CHURN_RISK = 'CHURN_RISK',
    LONG_TERM_CHURN = 'LONG_TERM_CHURN',
    BLOCKED = 'BLOCKED',
    SUPPRESSED = 'SUPPRESSED',
}

async function main() {
    console.log('Seeding FSM System...');

    // 1. Create Default Version
    const currentVersionName = 'v1.0.0 (Initial)';

    // Confirmed property names via inspection: fSMVersion, fSMState

    let version = await prisma.fSMVersion.findFirst({
        where: { name: currentVersionName }
    });

    if (!version) {
        version = await prisma.fSMVersion.create({
            data: {
                name: currentVersionName,
                isActive: true
            }
        });
        console.log('Created FSM Version:', version.id);
    } else {
        console.log('Using existing FSM Version:', version.id);
    }

    const states = Object.values(FSMStateCode);
    let positionY = 0;

    for (const name of states) {
        const isInitial = name === FSMStateCode.NEW;
        let isTerminal = false;
        if ([FSMStateCode.BLOCKED, FSMStateCode.SUPPRESSED, FSMStateCode.LONG_TERM_CHURN].includes(name as FSMStateCode)) {
            isTerminal = true;
        }

        // Upsert State linked to Version
        // Since unique is [versionId, name]
        await prisma.fSMState.upsert({
            where: {
                versionId_name: {
                    versionId: version.id,
                    name: name
                }
            },
            update: {
                isTerminal, // Update terminal flag if changed
            },
            create: {
                versionId: version.id,
                name,
                description: `System state: ${name}`,
                isInitial,
                isTerminal,
                positionX: 250,
                positionY: positionY,
            },
        });

        positionY += 100;
    }

    console.log(`Seeded ${states.length} FSM states into version ${version.id}.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
