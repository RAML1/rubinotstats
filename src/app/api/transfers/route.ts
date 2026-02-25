import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const fromWorld = searchParams.get('fromWorld')?.trim() || '';
    const toWorld = searchParams.get('toWorld')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.playerName = { contains: search, mode: 'insensitive' };
    }
    if (fromWorld) {
      where.fromWorld = fromWorld;
    }
    if (toWorld) {
      where.toWorld = toWorld;
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        orderBy: { transferDate: 'desc' },
        take: limit,
        skip,
      }),
      prisma.transfer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: transfers.map((t) => ({
        id: t.id,
        playerName: t.playerName,
        fromWorld: t.fromWorld,
        toWorld: t.toWorld,
        level: t.level,
        vocation: t.vocation,
        transferDate: t.transferDate?.toISOString() ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch transfers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transfers' },
      { status: 500 },
    );
  }
}
