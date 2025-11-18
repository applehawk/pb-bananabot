import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: params.id },
      include: {
        user: {
          select: {
            username: true,
            firstName: true,
            telegramId: true,
          },
        },
      },
    });

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Convert BigInt to string for JSON serialization
    const serializedSettings = {
      ...settings,
      user: {
        ...settings.user,
        telegramId: settings.user.telegramId.toString(),
      },
    };

    return NextResponse.json(serializedSettings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    const settings = await prisma.userSettings.upsert({
      where: { userId: params.id },
      update: {
        aspectRatio: data.aspectRatio,
        numberOfImages: data.numberOfImages,
        safetyLevel: data.safetyLevel,
        language: data.language,
        hdQuality: data.hdQuality,
        autoEnhance: data.autoEnhance,
        useNegativePrompt: data.useNegativePrompt,
        notifyOnComplete: data.notifyOnComplete,
        notifyOnBonus: data.notifyOnBonus,
      },
      create: {
        userId: params.id,
        aspectRatio: data.aspectRatio,
        numberOfImages: data.numberOfImages,
        safetyLevel: data.safetyLevel,
        language: data.language,
        hdQuality: data.hdQuality,
        autoEnhance: data.autoEnhance,
        useNegativePrompt: data.useNegativePrompt,
        notifyOnComplete: data.notifyOnComplete,
        notifyOnBonus: data.notifyOnBonus,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
