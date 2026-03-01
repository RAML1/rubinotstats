import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const world = searchParams.get('world')?.trim() || '';
    const timeRange = searchParams.get('timeRange') || 'all';
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { killerName: { contains: search, mode: 'insensitive' } },
        { victimName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (world) {
      where.world = world;
    }
    if (timeRange !== 'all') {
      const now = new Date();
      const hoursMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };
      const hours = hoursMap[timeRange];
      if (hours) {
        where.killedAt = { gte: new Date(now.getTime() - hours * 60 * 60 * 1000) };
      }
    }

    const [kills, total] = await Promise.all([
      prisma.pvpKill.findMany({
        where,
        orderBy: { killedAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.pvpKill.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: kills.map((k) => ({
        id: k.id,
        killerName: k.killerName,
        killerLevel: k.killerLevel,
        victimName: k.victimName,
        victimLevel: k.victimLevel,
        mostDamageBy: k.mostDamageBy,
        mostDamageIsPlayer: k.mostDamageIsPlayer,
        world: k.world,
        killedAt: k.killedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch PvP kills:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PvP kills' },
      { status: 500 },
    );
  }
}
