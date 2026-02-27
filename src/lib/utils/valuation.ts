import prisma from '@/lib/db/prisma';

// PREMIUM_GATE: This module is available to all users now.
// To gate behind premium, wrap the call to computeValuations() in a premium check.

export type ValuationData = {
  estimatedValue: number; // median sold price + item bonus
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  itemBonus: number; // TC added for valuable equipped items
};

// ── Item bonus scoring ──────────────────────────────────────────────────

const TIER_VALUES: Record<number, number> = {
  1: 2, 2: 5, 3: 12, 4: 25, 5: 50,
};

const HIGH_VALUE_KEYWORDS = [
  'sanguine', 'falcon', 'cobra', 'soul', 'lion',
  'eldritch', 'spiritthorn', 'alicorn',
];

const POINTS_TO_TC = 2;
const MAX_ITEM_BONUS_RATIO = 0.30; // cap at 30% of base estimate

interface DisplayItem {
  name?: string;
  tier?: number;
}

function computeItemBonus(displayItems: string | null, baseEstimate: number): number {
  if (!displayItems) return 0;
  try {
    const parsed = JSON.parse(displayItems);
    if (!Array.isArray(parsed)) return 0;

    let points = 0;
    for (const item of parsed) {
      if (typeof item === 'string') continue; // old format (URL only), skip
      const { name, tier } = item as DisplayItem;
      // Tier bonus
      if (tier && tier > 0) {
        points += TIER_VALUES[tier] ?? tier * 10;
      }
      // High-value item bonus
      if (name) {
        const lower = name.toLowerCase();
        if (HIGH_VALUE_KEYWORDS.some((kw) => lower.includes(kw))) {
          points += 10;
        }
      }
    }

    if (points === 0) return 0;
    const bonus = points * POINTS_TO_TC;
    return Math.min(bonus, Math.round(baseEstimate * MAX_ITEM_BONUS_RATIO));
  } catch {
    return 0;
  }
}

/** Map base vocations to their promoted counterpart for pooling data */
const VOCATION_FAMILY: Record<string, string> = {
  Knight: 'Knight',
  'Elite Knight': 'Knight',
  Paladin: 'Paladin',
  'Royal Paladin': 'Paladin',
  Sorcerer: 'Sorcerer',
  'Master Sorcerer': 'Sorcerer',
  Druid: 'Druid',
  'Elder Druid': 'Druid',
  Monk: 'Monk',
  'Exalted Monk': 'Monk',
  None: 'None',
};

function getVocationFamily(vocation: string): string {
  return VOCATION_FAMILY[vocation] || vocation;
}

function getLevelBand(level: number): number {
  return Math.floor(level / 100) * 100;
}

interface BucketRow {
  vocation: string;
  level_band: number;
  sample_size: bigint;
  median_price: number;
  min_price: number;
  max_price: number;
}

interface ValuationBucket {
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
}

/**
 * Pre-compute estimated values for a batch of current auctions.
 * Uses sold auction history grouped by vocation family + level band (100-level buckets).
 */
export async function computeValuations(
  auctions: Array<{ id: number; vocation: string | null; level: number | null; displayItems?: string | null }>
): Promise<Record<number, ValuationData>> {
  // Fetch aggregated stats from sold auctions in a single query
  const rows = await prisma.$queryRaw<BucketRow[]>`
    SELECT
      vocation,
      (FLOOR(level / 100) * 100)::int as level_band,
      COUNT(*)::bigint as sample_size,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) as median_price,
      MIN(sold_price) as min_price,
      MAX(sold_price) as max_price
    FROM auctions
    WHERE auction_status = 'sold'
      AND sold_price > 0
      AND level IS NOT NULL
      AND vocation IS NOT NULL
    GROUP BY vocation, FLOOR(level / 100) * 100
    ORDER BY vocation, level_band
  `;

  // Build lookup map: "vocationFamily:levelBand" -> bucket
  // Pool base + promoted vocations together
  const pooled = new Map<string, { prices: number[]; min: number; max: number }>();

  for (const row of rows) {
    const family = getVocationFamily(row.vocation);
    const key = `${family}:${row.level_band}`;
    const existing = pooled.get(key);
    if (existing) {
      // Merge: we can't perfectly merge medians, so we'll re-query pooled.
      // Instead, track min/max and approximate median from the row with more samples.
      existing.min = Math.min(existing.min, row.min_price);
      existing.max = Math.max(existing.max, row.max_price);
      existing.prices.push(
        ...Array(Number(row.sample_size)).fill(Number(row.median_price))
      );
    } else {
      pooled.set(key, {
        prices: Array(Number(row.sample_size)).fill(Number(row.median_price)),
        min: row.min_price,
        max: row.max_price,
      });
    }
  }

  // Also build a direct bucket map from raw rows for exact vocation matches
  const directBuckets = new Map<string, ValuationBucket>();
  for (const row of rows) {
    const family = getVocationFamily(row.vocation);
    const key = `${family}:${row.level_band}`;
    const existing = directBuckets.get(key);
    const sampleSize = Number(row.sample_size);
    if (existing) {
      existing.sampleSize += sampleSize;
      existing.minPrice = Math.min(existing.minPrice, row.min_price);
      existing.maxPrice = Math.max(existing.maxPrice, row.max_price);
      // Weighted average of medians as approximation
      const totalSamples = existing.sampleSize;
      const prevWeight = (totalSamples - sampleSize) / totalSamples;
      const newWeight = sampleSize / totalSamples;
      existing.medianPrice = Math.round(
        existing.medianPrice * prevWeight + Number(row.median_price) * newWeight
      );
    } else {
      directBuckets.set(key, {
        medianPrice: Math.round(Number(row.median_price)),
        minPrice: row.min_price,
        maxPrice: row.max_price,
        sampleSize,
      });
    }
  }

  // Map each auction to its valuation
  const result: Record<number, ValuationData> = {};

  for (const auction of auctions) {
    if (!auction.vocation || !auction.level) continue;

    const family = getVocationFamily(auction.vocation);
    const band = getLevelBand(auction.level);
    const key = `${family}:${band}`;

    let bucket = directBuckets.get(key);

    // If no exact band match or too few samples, try adjacent bands
    if (!bucket || bucket.sampleSize < 3) {
      const lowerKey = `${family}:${band - 100}`;
      const upperKey = `${family}:${band + 100}`;
      const lower = directBuckets.get(lowerKey);
      const upper = directBuckets.get(upperKey);

      // Merge adjacent bands
      const candidates = [bucket, lower, upper].filter(
        (b): b is ValuationBucket => !!b
      );
      if (candidates.length > 0) {
        const totalSamples = candidates.reduce((s, c) => s + c.sampleSize, 0);
        if (totalSamples >= 3) {
          const weightedMedian = candidates.reduce(
            (sum, c) => sum + c.medianPrice * (c.sampleSize / totalSamples),
            0
          );
          bucket = {
            medianPrice: Math.round(weightedMedian),
            minPrice: Math.min(...candidates.map((c) => c.minPrice)),
            maxPrice: Math.max(...candidates.map((c) => c.maxPrice)),
            sampleSize: totalSamples,
          };
        }
      }
    }

    if (bucket && bucket.sampleSize >= 3) {
      const itemBonus = computeItemBonus(
        (auction as { displayItems?: string | null }).displayItems ?? null,
        bucket.medianPrice,
      );
      result[auction.id] = {
        estimatedValue: bucket.medianPrice + itemBonus,
        minPrice: bucket.minPrice,
        maxPrice: bucket.maxPrice + itemBonus,
        sampleSize: bucket.sampleSize,
        itemBonus,
      };
    }
  }

  return result;
}
