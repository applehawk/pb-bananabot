
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking usage of FSM models...');
    await prisma.$connect(); // Explicit connect

    const keys = Object.keys(prisma);
    console.log('Keys on prisma client:', keys);

    // Check FSMVersion accessors
    // @ts-ignore
    console.log('fSMVersion:', typeof prisma.fSMVersion);
    // @ts-ignore
    console.log('fsmVersion:', typeof prisma.fsmVersion);
    // @ts-ignore
    console.log('FSMVersion:', typeof prisma.FSMVersion);

    // Check dmmf
    // @ts-ignore
    const modelNames = prisma._dmmf.datamodel.models.map(m => m.name);
    console.log('Available Models:', modelNames);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
