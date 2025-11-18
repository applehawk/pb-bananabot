import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');

    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const generations = await prisma.generation.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            telegramId: true,
          },
        },
        inputImages: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Convert BigInt to string for JSON serialization
    const serializedGenerations = generations.map(gen => ({
      ...gen,
      user: {
        ...gen.user,
        telegramId: gen.user.telegramId.toString(),
      },
    }));

    return NextResponse.json(serializedGenerations);
  } catch (error) {
    console.error('Error fetching generations:', error);
    return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
  }
}
