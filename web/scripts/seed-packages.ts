import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding credit packages...');

  const starter = await prisma.creditPackage.upsert({
    where: { id: 'starter-pack' },
    update: {},
    create: {
      id: 'starter-pack',
      name: 'Starter',
      credits: 10,
      price: 100,
      currency: 'RUB',
      discount: 0,
      popular: false,
      active: true,
      priceYooMoney: 99,
      priceStars: 100,
      priceCrypto: null,
      description: 'Попробуйте наш сервис - 10 генераций',
    },
  });
  console.log('✓ Created:', starter.name);

  const pro = await prisma.creditPackage.upsert({
    where: { id: 'pro-pack' },
    update: {},
    create: {
      id: 'pro-pack',
      name: 'Pro',
      credits: 50,
      price: 499,
      currency: 'RUB',
      discount: 20,
      popular: true,
      active: true,
      priceYooMoney: 399,
      priceStars: 400,
      priceCrypto: 6,
      description: '⭐ Самый популярный! 50 генераций со скидкой 20%',
    },
  });
  console.log('✓ Created:', pro.name);

  const ultimate = await prisma.creditPackage.upsert({
    where: { id: 'ultimate-pack' },
    update: {},
    create: {
      id: 'ultimate-pack',
      name: 'Ultimate',
      credits: 150,
      price: 1299,
      currency: 'RUB',
      discount: 30,
      popular: false,
      active: true,
      priceYooMoney: 999,
      priceStars: 1000,
      priceCrypto: 15,
      description: '💎 Максимальная экономия! 150 генераций со скидкой 30%',
    },
  });
  console.log('✓ Created:', ultimate.name);

  console.log('\n✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
