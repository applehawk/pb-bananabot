
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'UserSettings';
    `;
        console.log('UserSettings columns:', result);

        const migrations = await prisma.$queryRaw`
      SELECT * FROM _prisma_migrations ORDER BY started_at DESC;
    `;
        console.log('Migrations:', migrations);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
