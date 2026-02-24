import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { isPremium } from "@/lib/utils/premium";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPremium({ premiumTier: session.user.premiumTier, premiumUntil: session.user.premiumUntil })) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }

  // 1. Average sold price by vocation + level band
  const priceByVocation = await prisma.$queryRaw<
    { vocation: string; level_band: string; avg_price: number; median_price: number; count: number }[]
  >`
    SELECT
      vocation,
      CASE
        WHEN level BETWEEN 8 AND 99 THEN '8-99'
        WHEN level BETWEEN 100 AND 199 THEN '100-199'
        WHEN level BETWEEN 200 AND 299 THEN '200-299'
        WHEN level BETWEEN 300 AND 499 THEN '300-499'
        WHEN level >= 500 THEN '500+'
        ELSE 'Unknown'
      END AS level_band,
      ROUND(AVG(sold_price))::int AS avg_price,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
      COUNT(*)::int AS count
    FROM auctions
    WHERE auction_status = 'sold'
      AND sold_price > 0
      AND vocation IS NOT NULL
      AND level IS NOT NULL
    GROUP BY vocation, level_band
    HAVING COUNT(*) >= 3
    ORDER BY vocation, MIN(level)
  `;

  // 2. Average skills by vocation (for sold characters)
  const skillsByVocation = await prisma.$queryRaw<
    {
      vocation: string;
      avg_ml: number;
      avg_fist: number;
      avg_club: number;
      avg_sword: number;
      avg_axe: number;
      avg_distance: number;
      avg_shielding: number;
      avg_level: number;
      count: number;
    }[]
  >`
    SELECT
      vocation,
      ROUND(AVG(magic_level))::int AS avg_ml,
      ROUND(AVG(fist))::int AS avg_fist,
      ROUND(AVG(club))::int AS avg_club,
      ROUND(AVG(sword))::int AS avg_sword,
      ROUND(AVG(axe))::int AS avg_axe,
      ROUND(AVG(distance))::int AS avg_distance,
      ROUND(AVG(shielding))::int AS avg_shielding,
      ROUND(AVG(level))::int AS avg_level,
      COUNT(*)::int AS count
    FROM auctions
    WHERE auction_status = 'sold'
      AND vocation IS NOT NULL
      AND magic_level IS NOT NULL
    GROUP BY vocation
    HAVING COUNT(*) >= 5
    ORDER BY vocation
  `;

  // 3. Price trends — average sold price grouped by week
  const priceTrends = await prisma.$queryRaw<
    { week: string; avg_price: number; count: number }[]
  >`
    SELECT
      TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week,
      ROUND(AVG(sold_price))::int AS avg_price,
      COUNT(*)::int AS count
    FROM auctions
    WHERE auction_status = 'sold'
      AND sold_price > 0
    GROUP BY DATE_TRUNC('week', created_at)
    HAVING COUNT(*) >= 3
    ORDER BY week DESC
    LIMIT 52
  `;

  // 4. Best deals — current auctions priced well below estimated value
  const marketStats = await prisma.marketStats.findMany();
  const currentAuctions = await prisma.currentAuction.findMany({
    where: { isActive: true, currentBid: { gt: 0 }, level: { not: null }, vocation: { not: null } },
    orderBy: { currentBid: "asc" },
    take: 500,
  });

  const bestDeals: {
    characterName: string;
    externalId: string;
    level: number;
    vocation: string;
    currentBid: number;
    estimatedValue: number;
    discount: number;
  }[] = [];

  for (const auction of currentAuctions) {
    if (!auction.level || !auction.vocation || !auction.currentBid) continue;
    const stat = marketStats.find(
      (s) =>
        s.vocation === auction.vocation &&
        auction.level! >= s.levelMin &&
        auction.level! <= s.levelMax
    );
    if (!stat || !stat.medianPrice) continue;
    const estimated = Number(stat.medianPrice);
    if (estimated <= 0) continue;
    const discount = Math.round(((estimated - auction.currentBid) / estimated) * 100);
    if (discount >= 20) {
      bestDeals.push({
        characterName: auction.characterName,
        externalId: auction.externalId,
        level: auction.level,
        vocation: auction.vocation,
        currentBid: auction.currentBid,
        estimatedValue: Math.round(estimated),
        discount,
      });
    }
  }
  bestDeals.sort((a, b) => b.discount - a.discount);

  // 5. Overall stats
  const overallStats = await prisma.$queryRaw<
    { total_sold: number; avg_price: number; total_current: number }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM auctions WHERE auction_status = 'sold') AS total_sold,
      (SELECT ROUND(AVG(sold_price))::int FROM auctions WHERE auction_status = 'sold' AND sold_price > 0) AS avg_price,
      (SELECT COUNT(*)::int FROM current_auctions WHERE is_active = true) AS total_current
  `;

  return NextResponse.json({
    success: true,
    data: {
      priceByVocation,
      skillsByVocation,
      priceTrends: priceTrends.reverse(),
      bestDeals: bestDeals.slice(0, 20),
      overallStats: overallStats[0],
    },
  });
}
