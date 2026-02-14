import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const world = searchParams.get('world'); // optional world filter

    const whereBase: any = { vocation: { not: null }, soldPrice: { not: null } };
    const whereAll: any = {};
    if (world && world !== 'all') {
      whereBase.world = world;
      whereAll.world = world;
    }

    const [vocationStats, recentHighPrice, recentLowPrice, totalAuctions, worlds, avgSkills] =
      await Promise.all([
        prisma.auction.groupBy({
          by: ['vocation'],
          _count: { id: true },
          _avg: { soldPrice: true, coinsPerLevel: true },
          _min: { soldPrice: true },
          _max: { soldPrice: true },
          where: whereBase,
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.auction.findFirst({
          orderBy: { soldPrice: 'desc' },
          where: { soldPrice: { not: null }, ...(world && world !== 'all' ? { world } : {}) },
          select: {
            characterName: true,
            soldPrice: true,
            level: true,
            vocation: true,
            world: true,
          },
        }),
        prisma.auction.findFirst({
          orderBy: { soldPrice: 'asc' },
          where: {
            soldPrice: { not: null, gt: 0 },
            ...(world && world !== 'all' ? { world } : {}),
          },
          select: {
            characterName: true,
            soldPrice: true,
            level: true,
            vocation: true,
            world: true,
          },
        }),
        prisma.auction.count({
          where: world && world !== 'all' ? { world } : {},
        }),
        // Get distinct worlds for the filter
        prisma.auction
          .findMany({
            distinct: ['world'],
            select: { world: true },
            where: { world: { not: null } },
            orderBy: { world: 'asc' },
          })
          .then((rows) => rows.map((r) => r.world).filter(Boolean) as string[]),
        // Avg skills by vocation (filtered by world if applicable)
        prisma.auction.groupBy({
          by: ['vocation'],
          _avg: {
            magicLevel: true,
            fist: true,
            club: true,
            sword: true,
            axe: true,
            distance: true,
            shielding: true,
            level: true,
          },
          where: { vocation: { not: null }, ...(world && world !== 'all' ? { world } : {}) },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        vocationStats,
        recentHighPrice,
        recentLowPrice,
        totalAuctions,
        worlds,
        avgSkills,
      },
    });
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
