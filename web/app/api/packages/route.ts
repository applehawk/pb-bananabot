import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const packages = await prisma.creditPackage.findMany({
      orderBy: [{ popular: 'desc' }, { price: 'asc' }],
    });
    return NextResponse.json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newPackage = await prisma.creditPackage.create({
      data: {
        name: body.name,
        credits: parseFloat(body.credits),
        price: parseFloat(body.price),
        currency: body.currency || 'RUB',
        discount: parseInt(body.discount) || 0,
        popular: body.popular || false,
        active: body.active !== false,
        priceYooMoney: body.priceYooMoney ? parseFloat(body.priceYooMoney) : null,
        priceStars: body.priceStars ? parseInt(body.priceStars) : null,
        priceCrypto: body.priceCrypto ? parseFloat(body.priceCrypto) : null,
        description: body.description || null,
      },
    });
    return NextResponse.json(newPackage, { status: 201 });
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}
