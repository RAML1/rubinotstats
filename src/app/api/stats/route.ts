import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const [totalAuctions, totalHighscoreEntries, totalWorlds, avgPrice, vocationBreakdown, topAuction] =
      await Promise.all([
        prisma.auction.count(),
        prisma.highscoreEntry.count(),
        prisma.world.count(),
        prisma.auction.aggregate({ _avg: { soldPrice: true } }),
        prisma.auction.groupBy({
          by: ['vocation'],
          _count: { id: true },
          _avg: { soldPrice: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.auction.findFirst({
          orderBy: { soldPrice: 'desc' },
          select: { characterName: true, soldPrice: true, level: true, vocation: true, world: true },
        }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        totalAuctions,
        totalHighscoreEntries,
        totalWorlds,
        avgPrice: Math.round(avgPrice._avg.soldPrice || 0),
        vocationBreakdown: vocationBreakdown.map((v) => ({
          vocation: v.vocation,
          count: v._count.id,
          avgPrice: Math.round(v._avg.soldPrice || 0),
        })),
        topAuction,
      },
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
