import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// PATCH: Mark listing as sold or deactivate
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json({ success: false, error: 'Invalid listing ID' }, { status: 400 });
    }

    const body = await request.json();
    const { isActive, characterName, creatorToken, markSold } = body;

    const listing = await prisma.itemListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    // Auth: match by creatorToken (preferred) or fall back to characterName
    const tokenMatch = creatorToken && listing.creatorToken && listing.creatorToken === creatorToken;
    const nameMatch = characterName && listing.characterName === characterName;
    if (!tokenMatch && !nameMatch) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const data: Record<string, unknown> = { isActive: isActive ?? false };
    if (markSold) data.soldAt = new Date();

    const updated = await prisma.itemListing.update({
      where: { id: listingId },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Item listing PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Hard-delete a listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json({ success: false, error: 'Invalid listing ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const characterName = searchParams.get('characterName');
    const creatorToken = searchParams.get('creatorToken');

    const listing = await prisma.itemListing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 });
    }

    const tokenMatch = creatorToken && listing.creatorToken && listing.creatorToken === creatorToken;
    const nameMatch = characterName && listing.characterName === characterName;
    if (!tokenMatch && !nameMatch) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.itemListing.delete({ where: { id: listingId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Item listing DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
