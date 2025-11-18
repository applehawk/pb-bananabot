import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    const where = userId ? { userId } : {};

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            telegramId: true,
          },
        },
        package: true,
      },
      orderBy: { [sortBy]: order },
      take: 100,
    });

    // Convert BigInt to string for JSON serialization
    const serializedTransactions = transactions.map(tx => ({
      ...tx,
      user: {
        ...tx.user,
        telegramId: tx.user.telegramId.toString(),
      },
    }));

    return NextResponse.json(serializedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
