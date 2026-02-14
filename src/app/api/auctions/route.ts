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
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const sort = searchParams.get('sort') || 'soldPrice';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (vocation) where.vocation = vocation;
    if (world) where.world = world;
    if (minLevel || maxLevel) {
      where.level = {
        ...(minLevel ? { gte: parseInt(minLevel) } : {}),
        ...(maxLevel ? { lte: parseInt(maxLevel) } : {}),
      };
    }
    if (minPrice || maxPrice) {
      where.soldPrice = {
        ...(minPrice ? { gte: parseInt(minPrice) } : {}),
        ...(maxPrice ? { lte: parseInt(maxPrice) } : {}),
      };
    }
    if (search) {
      where.characterName = { contains: search, mode: 'insensitive' };
    }

    const allowedSortFields = ['soldPrice', 'level', 'characterName', 'vocation', 'world', 'coinsPerLevel', 'magicLevel', 'createdAt'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'soldPrice';

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortField]: order },
      }),
      prisma.auction.count({ where }),
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
    return NextResponse.json({ success: false, error: 'Failed to fetch auctions' }, { status: 500 });
  }
}
