#!/usr/bin/env tsx
/**
 * Refresh market_stats table with aggregated pricing data from sold auctions.
 *
 * Computes per-vocation, per-level-band statistics:
 *   - avg/median/min/max price
 *   - price per level, price per magic level, charm point value
 *   - sample size
 *
 * Usage:
 *   pnpm refresh:stats
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const VOCATION_FAMILIES: Record<string, string[]> = {
  'Knight': ['Knight', 'Elite Knight'],
  'Paladin': ['Paladin', 'Royal Paladin'],
  'Sorcerer': ['Sorcerer', 'Master Sorcerer'],
  'Druid': ['Druid', 'Elder Druid'],
  'Monk': ['Monk', 'Exalted Monk'],
};

const LEVEL_BANDS = [
  { min: 8, max: 99 },
  { min: 100, max: 199 },
  { min: 200, max: 299 },
  { min: 300, max: 399 },
  { min: 400, max: 499 },
  { min: 500, max: 699 },
  { min: 700, max: 999 },
  { min: 1000, max: 9999 },
];

interface StatsRow {
  avg_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  sample_size: number;
  avg_level: number;
  avg_ml: number | null;
  avg_charm: number | null;
}

async function main() {
  console.log('Refreshing market stats...\n');

  let upserted = 0;

  for (const [family, vocations] of Object.entries(VOCATION_FAMILIES)) {
    for (const band of LEVEL_BANDS) {
      const rows = await prisma.$queryRaw<StatsRow[]>`
        SELECT
          ROUND(AVG(sold_price))::int AS avg_price,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price)::int AS median_price,
          MIN(sold_price)::int AS min_price,
          MAX(sold_price)::int AS max_price,
          COUNT(*)::int AS sample_size,
          ROUND(AVG(level), 1) AS avg_level,
          ROUND(AVG(magic_level), 1) AS avg_ml,
          ROUND(AVG(charm_points), 1) AS avg_charm
        FROM auctions
        WHERE auction_status = 'sold'
          AND sold_price > 0
          AND level BETWEEN ${band.min} AND ${band.max}
          AND vocation = ANY(${vocations})
      `;

      if (!rows[0] || rows[0].sample_size < 3) continue;

      const r = rows[0];

      // Price per level: avg_price / avg_level
      const pricePerLevel = r.avg_level > 0
        ? Math.round((r.avg_price / r.avg_level) * 100) / 100
        : null;

      // Price per magic level
      const pricePerMl = r.avg_ml && r.avg_ml > 0
        ? Math.round((r.avg_price / r.avg_ml) * 100) / 100
        : null;

      // Charm point value: how much does 1 charm point add to price?
      // Simple approximation: avg_price / avg_charm
      const charmPointValue = r.avg_charm && r.avg_charm > 0
        ? Math.round((r.avg_price / r.avg_charm) * 1000) / 1000
        : null;

      await prisma.marketStats.upsert({
        where: {
          vocation_levelMin_levelMax: {
            vocation: family,
            levelMin: band.min,
            levelMax: band.max,
          },
        },
        update: {
          avgPrice: pricePerLevel != null ? new Prisma.Decimal(r.avg_price) : null,
          medianPrice: new Prisma.Decimal(r.median_price),
          minPrice: r.min_price,
          maxPrice: r.max_price,
          pricePerLevel: pricePerLevel != null ? new Prisma.Decimal(pricePerLevel) : null,
          pricePerMl: pricePerMl != null ? new Prisma.Decimal(pricePerMl) : null,
          charmPointValue: charmPointValue != null ? new Prisma.Decimal(charmPointValue) : null,
          sampleSize: r.sample_size,
          calculatedAt: new Date(),
        },
        create: {
          vocation: family,
          levelMin: band.min,
          levelMax: band.max,
          avgPrice: new Prisma.Decimal(r.avg_price),
          medianPrice: new Prisma.Decimal(r.median_price),
          minPrice: r.min_price,
          maxPrice: r.max_price,
          pricePerLevel: pricePerLevel != null ? new Prisma.Decimal(pricePerLevel) : null,
          pricePerMl: pricePerMl != null ? new Prisma.Decimal(pricePerMl) : null,
          charmPointValue: charmPointValue != null ? new Prisma.Decimal(charmPointValue) : null,
          sampleSize: r.sample_size,
        },
      });

      upserted++;
      console.log(`  ${family} ${band.min}-${band.max}: median=${r.median_price} TC, n=${r.sample_size}`);
    }
  }

  console.log(`\nDone. Upserted ${upserted} market stats rows.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
