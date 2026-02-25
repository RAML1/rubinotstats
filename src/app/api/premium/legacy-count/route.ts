import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const LEGACY_LIMIT = 20;

export async function GET() {
  try {
    const count = await prisma.user.count({
      where: { premiumTier: 'legacy' },
    });

    return NextResponse.json({
      success: true,
      data: {
        count,
        limit: LEGACY_LIMIT,
        remaining: Math.max(0, LEGACY_LIMIT - count),
        isFull: count >= LEGACY_LIMIT,
      },
    });
  } catch (error) {
    console.error('Failed to fetch legacy count:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch legacy count' },
      { status: 500 },
    );
  }
}
