import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// POST: Upvote a feature request (toggle)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const featureRequestId = parseInt(id);
    if (isNaN(featureRequestId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { voterToken } = body;

    if (!voterToken || typeof voterToken !== 'string' || voterToken.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Voter token is required' },
        { status: 400 }
      );
    }

    const featureRequest = await prisma.featureRequest.findUnique({
      where: { id: featureRequestId },
    });
    if (!featureRequest) {
      return NextResponse.json(
        { success: false, error: 'Feature request not found' },
        { status: 404 }
      );
    }

    // Check if already voted
    const existingVote = await prisma.featureRequestVote.findUnique({
      where: {
        featureRequestId_voterToken: {
          featureRequestId,
          voterToken,
        },
      },
    });

    if (existingVote) {
      // Remove vote (toggle off)
      await prisma.$transaction([
        prisma.featureRequestVote.delete({
          where: { id: existingVote.id },
        }),
        prisma.featureRequest.update({
          where: { id: featureRequestId },
          data: { voteCount: { decrement: 1 } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { voted: false, voteCount: featureRequest.voteCount - 1 },
      });
    } else {
      // Add vote
      await prisma.$transaction([
        prisma.featureRequestVote.create({
          data: { featureRequestId, voterToken },
        }),
        prisma.featureRequest.update({
          where: { id: featureRequestId },
          data: { voteCount: { increment: 1 } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { voted: true, voteCount: featureRequest.voteCount + 1 },
      });
    }
  } catch (error) {
    console.error('Feature request vote error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
