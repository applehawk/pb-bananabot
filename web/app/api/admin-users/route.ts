import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Convert BigInt to string for JSON serialization
    const serializedAdmins = admins.map(admin => ({
      ...admin,
      telegramId: admin.telegramId.toString(),
    }));

    return NextResponse.json(serializedAdmins);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Failed to fetch admin users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const admin = await prisma.adminUser.create({
      data: {
        telegramId: BigInt(body.telegramId),
        username: body.username || null,
        role: body.role || 'ADMIN',
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedAdmin = {
      ...admin,
      telegramId: admin.telegramId.toString(),
    };

    return NextResponse.json(serializedAdmin, { status: 201 });
  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 });
  }
}
