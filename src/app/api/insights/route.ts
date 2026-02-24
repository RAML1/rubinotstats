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

  // Run all queries in parallel for performance
  const [
    priceByVocation,
    skillsByVocation,
    priceTrends,
    overallStatsRows,
    worldStats,
    priceDrivers,
    vocationMarketShare,
    priceDistribution,
    sellRateByPrice,
    topExpGainers,
  ] = await Promise.all([
    // 1. Average sold price by vocation + level band
    prisma.$queryRaw<
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
    `,

    // 2. Average skills by vocation (sold characters)
    prisma.$queryRaw<
      {
        vocation: string; avg_ml: number; avg_fist: number; avg_club: number;
        avg_sword: number; avg_axe: number; avg_distance: number;
        avg_shielding: number; avg_level: number; count: number;
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
    `,

    // 3. Price trends — weekly avg + median + volume
    prisma.$queryRaw<
      { week: string; avg_price: number; median_price: number; volume: number }[]
    >`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week,
        ROUND(AVG(sold_price))::int AS avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
        COUNT(*)::int AS volume
      FROM auctions
      WHERE auction_status = 'sold'
        AND sold_price > 0
      GROUP BY DATE_TRUNC('week', created_at)
      HAVING COUNT(*) >= 3
      ORDER BY week DESC
      LIMIT 52
    `,

    // 4. Overall stats (expanded)
    prisma.$queryRaw<
      {
        total_sold: number; avg_price: number; median_price: number;
        total_current: number; total_expired: number; sell_rate: number;
        highest_sale: number;
      }[]
    >`
      SELECT
        (SELECT COUNT(*)::int FROM auctions WHERE auction_status = 'sold') AS total_sold,
        (SELECT ROUND(AVG(sold_price))::int FROM auctions WHERE auction_status = 'sold' AND sold_price > 0) AS avg_price,
        (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int FROM auctions WHERE auction_status = 'sold' AND sold_price > 0) AS median_price,
        (SELECT COUNT(*)::int FROM current_auctions WHERE is_active = true) AS total_current,
        (SELECT COUNT(*)::int FROM auctions WHERE auction_status = 'expired') AS total_expired,
        (SELECT ROUND(COUNT(*) FILTER (WHERE auction_status = 'sold') * 100.0 / GREATEST(COUNT(*), 1))::int FROM auctions) AS sell_rate,
        (SELECT MAX(sold_price) FROM auctions WHERE auction_status = 'sold') AS highest_sale
    `,

    // 5. World stats — sell rate + avg price per world
    prisma.$queryRaw<
      { world: string; sold: number; expired: number; sell_rate: number; avg_price: number; median_price: number }[]
    >`
      SELECT
        world,
        COUNT(*) FILTER (WHERE auction_status = 'sold')::int AS sold,
        COUNT(*) FILTER (WHERE auction_status = 'expired')::int AS expired,
        ROUND(COUNT(*) FILTER (WHERE auction_status = 'sold') * 100.0 / GREATEST(COUNT(*), 1))::int AS sell_rate,
        ROUND(AVG(sold_price) FILTER (WHERE auction_status = 'sold' AND sold_price > 0))::int AS avg_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) FILTER (WHERE auction_status = 'sold' AND sold_price > 0)::int AS median_price
      FROM auctions
      WHERE world IS NOT NULL
      GROUP BY world
      HAVING COUNT(*) >= 10
      ORDER BY avg_price DESC
    `,

    // 6. Price drivers — charm points, boss points, quest access impact
    prisma.$queryRaw<
      {
        category: string; tier: string; avg_price: number;
        median_price: number; count: number;
      }[]
    >`
      (
        SELECT
          'Charm Points' AS category,
          CASE
            WHEN charm_points >= 5000 THEN 'High (5k+)'
            WHEN charm_points >= 1000 THEN 'Mid (1k-5k)'
            ELSE 'Low (<1k)'
          END AS tier,
          ROUND(AVG(sold_price))::int AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
          COUNT(*)::int AS count
        FROM auctions
        WHERE auction_status = 'sold' AND sold_price > 0 AND charm_points IS NOT NULL
        GROUP BY tier
      )
      UNION ALL
      (
        SELECT
          'Boss Points' AS category,
          CASE
            WHEN boss_points >= 5000 THEN 'High (5k+)'
            WHEN boss_points >= 1000 THEN 'Mid (1k-5k)'
            ELSE 'Low (<1k)'
          END AS tier,
          ROUND(AVG(sold_price))::int AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
          COUNT(*)::int AS count
        FROM auctions
        WHERE auction_status = 'sold' AND sold_price > 0 AND boss_points IS NOT NULL
        GROUP BY tier
      )
      UNION ALL
      (
        SELECT
          'Quest Access' AS category,
          CASE
            WHEN soul_war_available = true AND primal_ordeal_available = true AND sanguine_blood_available = true THEN 'All Quests'
            WHEN (soul_war_available = true OR primal_ordeal_available = true OR sanguine_blood_available = true) THEN 'Some Quests'
            ELSE 'No Quests'
          END AS tier,
          ROUND(AVG(sold_price))::int AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
          COUNT(*)::int AS count
        FROM auctions
        WHERE auction_status = 'sold' AND sold_price > 0
          AND soul_war_available IS NOT NULL
        GROUP BY tier
      )
      ORDER BY category, avg_price DESC
    `,

    // 7. Vocation market share (sold + expired)
    prisma.$queryRaw<
      { vocation: string; sold: number; expired: number; total: number; avg_price: number }[]
    >`
      SELECT
        vocation,
        COUNT(*) FILTER (WHERE auction_status = 'sold')::int AS sold,
        COUNT(*) FILTER (WHERE auction_status = 'expired')::int AS expired,
        COUNT(*)::int AS total,
        ROUND(AVG(sold_price) FILTER (WHERE auction_status = 'sold' AND sold_price > 0))::int AS avg_price
      FROM auctions
      WHERE vocation IS NOT NULL
        AND vocation NOT IN ('None', 'Monk', 'Sorcerer', 'Druid', 'Paladin', 'Knight')
      GROUP BY vocation
      ORDER BY total DESC
    `,

    // 8. Price distribution — histogram buckets
    prisma.$queryRaw<
      { price_range: string; count: number; sort_order: number }[]
    >`
      SELECT
        CASE
          WHEN sold_price < 100 THEN '<100'
          WHEN sold_price < 250 THEN '100-250'
          WHEN sold_price < 500 THEN '250-500'
          WHEN sold_price < 1000 THEN '500-1k'
          WHEN sold_price < 2500 THEN '1k-2.5k'
          WHEN sold_price < 5000 THEN '2.5k-5k'
          WHEN sold_price < 10000 THEN '5k-10k'
          WHEN sold_price < 25000 THEN '10k-25k'
          ELSE '25k+'
        END AS price_range,
        COUNT(*)::int AS count,
        CASE
          WHEN sold_price < 100 THEN 1
          WHEN sold_price < 250 THEN 2
          WHEN sold_price < 500 THEN 3
          WHEN sold_price < 1000 THEN 4
          WHEN sold_price < 2500 THEN 5
          WHEN sold_price < 5000 THEN 6
          WHEN sold_price < 10000 THEN 7
          WHEN sold_price < 25000 THEN 8
          ELSE 9
        END AS sort_order
      FROM auctions
      WHERE auction_status = 'sold' AND sold_price > 0
      GROUP BY price_range, sort_order
      ORDER BY sort_order
    `,

    // 9. Sell rate by minimum bid range (helps sellers price correctly)
    prisma.$queryRaw<
      { bid_range: string; total: number; sold: number; sell_rate: number; sort_order: number }[]
    >`
      SELECT
        CASE
          WHEN minimum_bid < 100 THEN '<100 TC'
          WHEN minimum_bid < 250 THEN '100-250 TC'
          WHEN minimum_bid < 500 THEN '250-500 TC'
          WHEN minimum_bid < 1000 THEN '500-1k TC'
          WHEN minimum_bid < 2500 THEN '1k-2.5k TC'
          WHEN minimum_bid < 5000 THEN '2.5k-5k TC'
          WHEN minimum_bid < 10000 THEN '5k-10k TC'
          ELSE '10k+ TC'
        END AS bid_range,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE auction_status = 'sold')::int AS sold,
        ROUND(COUNT(*) FILTER (WHERE auction_status = 'sold') * 100.0 / GREATEST(COUNT(*), 1))::int AS sell_rate,
        CASE
          WHEN minimum_bid < 100 THEN 1
          WHEN minimum_bid < 250 THEN 2
          WHEN minimum_bid < 500 THEN 3
          WHEN minimum_bid < 1000 THEN 4
          WHEN minimum_bid < 2500 THEN 5
          WHEN minimum_bid < 5000 THEN 6
          WHEN minimum_bid < 10000 THEN 7
          ELSE 8
        END AS sort_order
      FROM auctions
      WHERE minimum_bid IS NOT NULL AND minimum_bid > 0
      GROUP BY bid_range, sort_order
      ORDER BY sort_order
    `,

    // 10. Top EXP gainers (last 7 days — from materialized view)
    prisma.$queryRaw<
      { character_name: string; world: string; vocation: string; current_level: number; exp_gained: bigint; levels_gained: number }[]
    >`
      SELECT character_name, world, vocation, current_level, exp_gained, levels_gained
      FROM top_exp_gainers_mv
      ORDER BY exp_gained DESC
      LIMIT 15
    `,
  ]);

  // Best deals — computed in-memory from current auctions vs market stats
  const marketStats = await prisma.marketStats.findMany();
  const currentAuctions = await prisma.currentAuction.findMany({
    where: { isActive: true, currentBid: { gt: 0 }, level: { not: null }, vocation: { not: null } },
    orderBy: { currentBid: "asc" },
    take: 500,
  });

  const bestDeals: {
    characterName: string; externalId: string; level: number;
    vocation: string; currentBid: number; estimatedValue: number; discount: number;
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

  // Serialize BigInt/Decimal values from topExpGainers
  const serializedExpGainers = topExpGainers.map((g) => ({
    ...g,
    exp_gained: typeof g.exp_gained === 'bigint' ? Number(g.exp_gained) :
      (g.exp_gained && typeof (g.exp_gained as any).toNumber === 'function') ? (g.exp_gained as any).toNumber() :
      Number(String(g.exp_gained)),
  }));

  return NextResponse.json({
    success: true,
    data: {
      priceByVocation,
      skillsByVocation,
      priceTrends: priceTrends.reverse(),
      bestDeals: bestDeals.slice(0, 20),
      overallStats: overallStatsRows[0],
      worldStats,
      priceDrivers,
      vocationMarketShare,
      priceDistribution,
      sellRateByPrice,
      topExpGainers: serializedExpGainers,
    },
  });
}
