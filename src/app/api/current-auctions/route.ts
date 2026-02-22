import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const vocation = searchParams.get('vocation');
    const world = searchParams.get('world');
    const minLevel = searchParams.get('minLevel');
    const maxLevel = searchParams.get('maxLevel');
    const sort = searchParams.get('sort') || 'currentBid';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { isActive: true };

    if (vocation) where.vocation = vocation;
    if (world) where.world = world;
    if (minLevel || maxLevel) {
      where.level = {
        ...(minLevel ? { gte: parseInt(minLevel) } : {}),
        ...(maxLevel ? { lte: parseInt(maxLevel) } : {}),
      };
    }
    if (search) {
      where.characterName = { contains: search, mode: 'insensitive' };
    }

    const allowedSortFields = ['currentBid', 'minimumBid', 'level', 'characterName', 'vocation', 'world', 'magicLevel', 'createdAt', 'auctionEnd'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'currentBid';

    const [auctions, total] = await Promise.all([
      prisma.currentAuction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortField]: order },
      }),
      prisma.currentAuction.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: auctions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch current auctions' }, { status: 500 });
  }
}
