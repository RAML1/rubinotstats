import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const boosted = await prisma.boostedDaily.findUnique({
      where: { date: today },
    });

    if (!boosted) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        date: boosted.date,
        creature: boosted.boostedCreature
          ? { name: boosted.boostedCreature, looktype: boosted.creatureLooktype }
          : null,
        boss: boosted.boostedBoss
          ? { name: boosted.boostedBoss, looktype: boosted.bossLooktype }
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch boosted data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch boosted data' },
      { status: 500 }
    );
  }
}
