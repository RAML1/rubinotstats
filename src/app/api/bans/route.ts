import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const world = searchParams.get('world')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.playerName = { contains: search, mode: 'insensitive' };
    }
    if (world) {
      where.world = world;
    }

    const [bans, total] = await Promise.all([
      prisma.ban.findMany({
        where,
        orderBy: { bannedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.ban.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: bans.map((b) => ({
        id: b.id,
        playerName: b.playerName,
        world: b.world,
        reason: b.reason,
        bannedAt: b.bannedAt?.toISOString() ?? null,
        expiresAt: b.expiresAt?.toISOString() ?? null,
        isPermanent: b.isPermanent,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch bans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bans' },
      { status: 500 },
    );
  }
}
