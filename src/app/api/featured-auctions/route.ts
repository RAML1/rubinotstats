import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { isPremium } from "@/lib/utils/premium";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const now = new Date();

  const featured = await prisma.featuredAuction.findMany({
    where: { isActive: true, expiresAt: { gt: now } },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: featured });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPremium({ premiumTier: session.user.premiumTier, premiumUntil: session.user.premiumUntil })) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  const body = await request.json();
  const { auctionId } = body;

  if (!auctionId || typeof auctionId !== "string") {
    return NextResponse.json({ error: "auctionId is required" }, { status: 400 });
  }

  // Verify the auction exists and is active
  const auction = await prisma.currentAuction.findFirst({
    where: { externalId: auctionId, isActive: true },
  });

  if (!auction) {
    return NextResponse.json({ error: "Auction not found or no longer active" }, { status: 404 });
  }

  // Check if user already has an active featured auction
  const existing = await prisma.featuredAuction.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You already have a featured auction. Remove it first." },
      { status: 409 }
    );
  }

  // Featured auction expires when the auction ends or after 24h, whichever is sooner
  const auctionEnd = auction.auctionEnd ? new Date(auction.auctionEnd) : null;
  const twentyFourHours = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiresAt = auctionEnd && auctionEnd < twentyFourHours ? auctionEnd : twentyFourHours;

  const featured = await prisma.featuredAuction.create({
    data: {
      userId: session.user.id,
      auctionId,
      expiresAt,
    },
  });

  return NextResponse.json({ success: true, data: featured }, { status: 201 });
}
