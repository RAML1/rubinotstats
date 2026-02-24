import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET: List feature requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const sort = searchParams.get('sort') || 'votes'; // votes | newest
    const voterToken = searchParams.get('voterToken');

    const where: Record<string, unknown> = {};
    if (status !== 'all') where.status = status;

    const orderBy =
      sort === 'newest'
        ? { createdAt: 'desc' as const }
        : { voteCount: 'desc' as const };

    const requests = await prisma.featureRequest.findMany({
      where,
      orderBy,
      take: 100,
    });

    // If a voterToken was provided, get the IDs the user already voted on
    let votedIds: number[] = [];
    if (voterToken) {
      const votes = await prisma.featureRequestVote.findMany({
        where: { voterToken },
        select: { featureRequestId: true },
      });
      votedIds = votes.map((v) => v.featureRequestId);
    }

    return NextResponse.json({ success: true, data: { requests, votedIds } });
  } catch (error) {
    console.error('Feature requests GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new feature request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, authorName } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Title must be at least 5 characters' },
        { status: 400 }
      );
    }
    if (title.trim().length > 200) {
      return NextResponse.json(
        { success: false, error: 'Title must be under 200 characters' },
        { status: 400 }
      );
    }
    if (description && description.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Description must be under 2000 characters' },
        { status: 400 }
      );
    }

    const featureRequest = await prisma.featureRequest.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        authorName: authorName?.trim()?.substring(0, 100) || null,
      },
    });

    return NextResponse.json({ success: true, data: featureRequest });
  } catch (error) {
    console.error('Feature requests POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create feature request' },
      { status: 500 }
    );
  }
}
