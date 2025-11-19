import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking credit packages...\n');

  const packages = await prisma.creditPackage.findMany({
    orderBy: { price: 'asc' },
  });

  if (packages.length === 0) {
    console.log('❌ No packages found in database!');
    console.log('Run: npx tsx web/scripts/seed-packages.ts');
    return;
  }

  console.log(`✅ Found ${packages.length} packages:\n`);

  for (const pkg of packages) {
    console.log(`📦 ${pkg.name}`);
    console.log(`   ID: ${pkg.id}`);
    console.log(`   Credits: ${pkg.credits}`);
    console.log(`   Price YooMoney: ${pkg.priceYooMoney || 'N/A'} руб.`);
    console.log(`   Price Stars: ${pkg.priceStars || 'N/A'}`);
    console.log(`   Active: ${pkg.active ? '✓' : '✗'}`);
    console.log(`   Popular: ${pkg.popular ? '⭐' : ''}`);
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
