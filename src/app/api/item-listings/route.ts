import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET: List active item listings with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const world = searchParams.get('world');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const sortBy = searchParams.get('sort') || 'createdAt';
    const sortOrder = searchParams.get('order') || 'desc';

    const where: Record<string, unknown> = {
      isActive: true,
      expiresAt: { gt: new Date() },
    };
    if (world && world !== 'all') where.world = world;
    if (search) where.itemName = { contains: search, mode: 'insensitive' };

    const validSorts = ['createdAt', 'price', 'itemName'];
    const orderField = validSorts.includes(sortBy) ? sortBy : 'createdAt';

    const [listings, total, worlds] = await Promise.all([
      prisma.itemListing.findMany({
        where,
        orderBy: { [orderField]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.itemListing.count({ where }),
      prisma.itemListing.findMany({
        distinct: ['world'],
        select: { world: true },
        where: { isActive: true, expiresAt: { gt: new Date() } },
        orderBy: { world: 'asc' },
      }).then(rows => rows.map(r => r.world)),
    ]);

    return NextResponse.json({
      success: true,
      data: { listings, total, worlds, page, limit },
    });
  } catch (error) {
    console.error('Item listings GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new item listing
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemName, tier, price, quantity, characterName, world, contactInfo, description, creatorToken } = body;

    if (!itemName || typeof itemName !== 'string' || itemName.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Item name must be at least 2 characters' }, { status: 400 });
    }
    if (!price || typeof price !== 'number' || price < 1) {
      return NextResponse.json({ success: false, error: 'Price must be a positive number' }, { status: 400 });
    }
    if (!characterName || typeof characterName !== 'string' || characterName.trim().length < 2) {
      return NextResponse.json({ success: false, error: 'Character name is required' }, { status: 400 });
    }
    if (!world || typeof world !== 'string') {
      return NextResponse.json({ success: false, error: 'World is required' }, { status: 400 });
    }
    if (tier !== undefined && tier !== null && (typeof tier !== 'number' || tier < 0 || tier > 10)) {
      return NextResponse.json({ success: false, error: 'Tier must be between 0 and 10' }, { status: 400 });
    }

    // Listings expire after 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const listing = await prisma.itemListing.create({
      data: {
        itemName: itemName.trim(),
        tier: tier ?? null,
        price,
        quantity: quantity || 1,
        characterName: characterName.trim(),
        world,
        contactInfo: contactInfo?.trim() || null,
        description: description?.trim() || null,
        creatorToken: creatorToken?.trim() || null,
        expiresAt,
      },
    });

    return NextResponse.json({ success: true, data: listing });
  } catch (error) {
    console.error('Item listings POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create listing' }, { status: 500 });
  }
}
