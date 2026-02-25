import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

/**
 * Cron endpoint for updating auction bids.
 * Attempts to fetch /api/bazaar from RubinOT server-side.
 * Secured with CRON_SECRET env var.
 *
 * Usage:
 *   Railway cron → POST /api/cron/update-auctions -H "Authorization: Bearer $CRON_SECRET"
 *   With basic auth → curl -u user:pass -X POST .../api/cron/update-auctions -H "X-Cron-Secret: $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (accept via Authorization header or X-Cron-Secret for basic auth compat)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  if (authHeader !== `Bearer ${cronSecret}` && cronHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = 'https://rubinot.com.br';
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    let totalUpdated = 0;
    let totalDeactivated = 0;
    let totalPages = 1;
    const seenIds = new Set<string>();

    // Fetch page 1 to discover total pages
    const firstRes = await fetch(`${baseUrl}/api/bazaar?page=1`, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    });

    if (!firstRes.ok) {
      return NextResponse.json({
        success: false,
        error: `RubinOT API returned ${firstRes.status}. Cloudflare may be blocking server-side requests. Use "pnpm update:bids" locally instead.`,
      }, { status: 502 });
    }

    const firstData = await firstRes.json();
    totalPages = firstData.pagination?.totalPages || 1;

    // Process first page
    for (const auction of firstData.auctions || []) {
      const externalId = String(auction.id);
      seenIds.add(externalId);

      try {
        await prisma.currentAuction.update({
          where: { externalId },
          data: {
            minimumBid: auction.minimum_bid ?? null,
            currentBid: auction.current_bid ?? null,
            hasBeenBidOn: (auction.current_bid ?? 0) > (auction.minimum_bid ?? 0),
            auctionEnd: auction.auction_end ?? undefined,
          },
        });
        totalUpdated++;
      } catch {
        // Not in DB yet — skip
      }
    }

    // Fetch remaining pages
    for (let p = 2; p <= totalPages; p++) {
      try {
        const res = await fetch(`${baseUrl}/api/bazaar?page=${p}`, {
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        });

        if (!res.ok) {
          console.error(`Cron: bazaar page ${p} returned ${res.status}`);
          continue;
        }

        const data = await res.json();
        for (const auction of data.auctions || []) {
          const externalId = String(auction.id);
          seenIds.add(externalId);

          try {
            await prisma.currentAuction.update({
              where: { externalId },
              data: {
                minimumBid: auction.minimum_bid ?? null,
                currentBid: auction.current_bid ?? null,
                hasBeenBidOn: (auction.current_bid ?? 0) > (auction.minimum_bid ?? 0),
                auctionEnd: auction.auction_end ?? undefined,
              },
            });
            totalUpdated++;
          } catch {
            // Not in DB yet — skip
          }
        }
      } catch (err) {
        console.error(`Cron: failed page ${p}:`, err);
      }
    }

    // Deactivate auctions no longer on the site
    if (seenIds.size > 0) {
      const result = await prisma.currentAuction.updateMany({
        where: {
          isActive: true,
          externalId: { notIn: Array.from(seenIds) },
        },
        data: { isActive: false },
      });
      totalDeactivated = result.count;
    }

    return NextResponse.json({
      success: true,
      totalPages,
      totalUpdated,
      totalDeactivated,
      totalSeen: seenIds.size,
    });
  } catch (error) {
    console.error('Cron update-auctions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Also allow GET for easy manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
