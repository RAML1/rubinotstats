import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const world = searchParams.get('world');
  const category = searchParams.get('category') || 'Experience Points';
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

  const where: Record<string, unknown> = { category };
  if (world) where.world = world;

  const entries = await prisma.highscoreEntry.findMany({
    where,
    orderBy: { rank: 'asc' },
    take: limit,
    distinct: ['characterName', 'world'],
  });

  return NextResponse.json({
    success: true,
    data: entries,
    category,
    world: world || 'all',
  });
}
