
import { PrismaClient, LifecycleState, OverlayType } from '@prisma/client';

async function main() {
    console.log('Testing Prisma Imports...');
    try {
        console.log('LifecycleState:', LifecycleState);
        console.log('OverlayType:', OverlayType);

        if (!LifecycleState.ACTIVATING || !OverlayType.TRIPWIRE) {
            throw new Error('Missing enum values!');
        }
        console.log('✅ Imports verified successfuly.');
    } catch (e) {
        console.error('❌ Failed to import new types:', e);
        process.exit(1);
    }
}

main();
