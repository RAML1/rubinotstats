import prisma from '@/lib/db/prisma';

// PREMIUM_GATE: This module is available to all users now.
// To gate behind premium, wrap the call to computeValuations() in a premium check.

export type ValuationData = {
  estimatedValue: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  itemBonus: number;
  confidence: 'high' | 'medium' | 'low';
};

// ── Vocation helpers ──────────────────────────────────────────────────

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

const PRIMARY_SKILL: Record<string, string> = {
  Knight: 'sword',
  Paladin: 'distance',
  Sorcerer: 'magicLevel',
  Druid: 'magicLevel',
  Monk: 'fist',
  None: 'magicLevel',
};

function getVocationFamily(vocation: string): string {
  return VOCATION_FAMILY[vocation] || vocation;
}

function getFamilyVocations(family: string): string[] {
  return Object.entries(VOCATION_FAMILY)
    .filter(([, f]) => f === family)
    .map(([v]) => v);
}

// ── Item bonus scoring (kept for additive bonus) ─────────────────────

const TIER_VALUES: Record<number, number> = {
  1: 2, 2: 5, 3: 12, 4: 25, 5: 50,
};

const HIGH_VALUE_KEYWORDS = [
  'sanguine', 'falcon', 'cobra', 'soul', 'lion',
  'eldritch', 'spiritthorn', 'alicorn',
];

const POINTS_TO_TC = 2;
const MAX_ITEM_BONUS_RATIO = 0.30;

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
      if (typeof item === 'string') continue;
      const { name, tier } = item as DisplayItem;
      if (tier && tier > 0) {
        points += TIER_VALUES[tier] ?? tier * 10;
      }
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

// ── Display items similarity scoring ─────────────────────────────────

function computeDisplayItemPoints(displayItems: string | null): number {
  if (!displayItems) return 0;
  try {
    const parsed = JSON.parse(displayItems);
    if (!Array.isArray(parsed)) return 0;
    let points = 0;
    for (const item of parsed) {
      if (typeof item === 'string') continue;
      const { name, tier } = item as DisplayItem;
      if (tier && tier > 0) points += TIER_VALUES[tier] ?? tier * 10;
      if (name) {
        const lower = name.toLowerCase();
        if (HIGH_VALUE_KEYWORDS.some((kw) => lower.includes(kw))) points += 10;
      }
    }
    return points;
  } catch {
    return 0;
  }
}

// ── Similarity scoring ───────────────────────────────────────────────

const WEIGHTS = {
  level: 0.30,
  magicLevel: 0.15,
  primarySkill: 0.15,
  charm: 0.10,
  quests: 0.10,
  storeItems: 0.10,
  displayItems: 0.10,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function proximityScore(a: number | null | undefined, b: number | null | undefined, maxDiff: number): number {
  if (a == null || b == null) return 0.5; // neutral if missing
  return clamp(1 - Math.abs(a - b) / maxDiff, 0, 1);
}

interface SoldAuctionRow {
  external_id: string;
  level: number;
  vocation: string;
  sold_price: number;
  magic_level: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  charm_points: number | null;
  primal_ordeal_available: boolean | null;
  soul_war_available: boolean | null;
  sanguine_blood_available: boolean | null;
  store_items_count: number | null;
  display_items: string | null;
}

interface AuctionInput {
  id: number;
  vocation: string | null;
  level: number | null;
  magicLevel?: number | null;
  fist?: number | null;
  club?: number | null;
  sword?: number | null;
  axe?: number | null;
  distance?: number | null;
  shielding?: number | null;
  charmPoints?: number | null;
  primalOrdealAvailable?: boolean | null;
  soulWarAvailable?: boolean | null;
  sanguineBloodAvailable?: boolean | null;
  storeItemsCount?: number | null;
  displayItems?: string | null;
}

function computeSimilarity(target: AuctionInput, sold: SoldAuctionRow): number {
  const family = getVocationFamily(target.vocation!);
  const primarySkillField = PRIMARY_SKILL[family] || 'magicLevel';

  // Level proximity (within ±200 levels)
  const levelScore = proximityScore(target.level, sold.level, 200);

  // Magic level proximity
  const mlScore = proximityScore(target.magicLevel, sold.magic_level, 50);

  // Primary skill proximity
  let primaryScore = 0.5;
  if (primarySkillField === 'magicLevel') {
    primaryScore = mlScore;
  } else {
    const targetSkill = target[primarySkillField as keyof AuctionInput] as number | null | undefined;
    const soldSkill = sold[primarySkillField as keyof SoldAuctionRow] as number | null;
    primaryScore = proximityScore(targetSkill, soldSkill, 30);
  }

  // Charm points proximity
  const charmScore = proximityScore(target.charmPoints, sold.charm_points, 5000);

  // Quest matching
  let questScore = 0.5;
  let questMatches = 0;
  let questTotal = 0;
  if (target.primalOrdealAvailable != null && sold.primal_ordeal_available != null) {
    questMatches += target.primalOrdealAvailable === sold.primal_ordeal_available ? 1 : 0;
    questTotal++;
  }
  if (target.soulWarAvailable != null && sold.soul_war_available != null) {
    questMatches += target.soulWarAvailable === sold.soul_war_available ? 1 : 0;
    questTotal++;
  }
  if (target.sanguineBloodAvailable != null && sold.sanguine_blood_available != null) {
    questMatches += target.sanguineBloodAvailable === sold.sanguine_blood_available ? 1 : 0;
    questTotal++;
  }
  if (questTotal > 0) questScore = questMatches / questTotal;

  // Store items proximity
  const storeScore = proximityScore(target.storeItemsCount, sold.store_items_count, 50);

  // Display items similarity (point-based)
  const targetItemPts = computeDisplayItemPoints(target.displayItems ?? null);
  const soldItemPts = computeDisplayItemPoints(sold.display_items);
  const itemScore = proximityScore(targetItemPts, soldItemPts, 100);

  return (
    WEIGHTS.level * levelScore +
    WEIGHTS.magicLevel * mlScore +
    WEIGHTS.primarySkill * primaryScore +
    WEIGHTS.charm * charmScore +
    WEIGHTS.quests * questScore +
    WEIGHTS.storeItems * storeScore +
    WEIGHTS.displayItems * itemScore
  );
}

// ── Main valuation function ──────────────────────────────────────────

/**
 * Pre-compute estimated values for a batch of current auctions.
 * Uses similarity-based matching against sold auction history,
 * considering level, skills, charm, quests, store items, and display items.
 */
export async function computeValuations(
  auctions: AuctionInput[]
): Promise<Record<number, ValuationData>> {
  // Fetch ALL sold auctions with relevant fields (grouped processing in-memory)
  const soldRows = await prisma.$queryRaw<SoldAuctionRow[]>`
    SELECT
      external_id, level, vocation, sold_price,
      magic_level, fist, club, sword, axe, distance, shielding,
      charm_points, primal_ordeal_available, soul_war_available,
      sanguine_blood_available, store_items_count, display_items
    FROM auctions
    WHERE auction_status = 'sold'
      AND sold_price > 0
      AND level IS NOT NULL
      AND vocation IS NOT NULL
    ORDER BY level
  `;

  if (soldRows.length === 0) return {};

  // Group sold auctions by vocation family for faster lookup
  const soldByFamily = new Map<string, SoldAuctionRow[]>();
  for (const row of soldRows) {
    const family = getVocationFamily(row.vocation);
    const list = soldByFamily.get(family);
    if (list) list.push(row);
    else soldByFamily.set(family, [row]);
  }

  const result: Record<number, ValuationData> = {};

  for (const auction of auctions) {
    if (!auction.vocation || !auction.level) continue;

    const family = getVocationFamily(auction.vocation);
    const familySold = soldByFamily.get(family);
    if (!familySold) continue;

    // Filter to ±200 levels for efficiency
    const levelMin = Math.max(1, auction.level - 200);
    const levelMax = auction.level + 200;
    const candidates = familySold.filter(
      (s) => s.level >= levelMin && s.level <= levelMax
    );

    if (candidates.length < 3) continue;

    // Score each candidate by similarity
    const scored = candidates.map((s) => ({
      soldPrice: s.sold_price,
      similarity: computeSimilarity(auction, s),
      displayItems: s.display_items,
    }));

    // Filter by minimum similarity and take top 30
    const filtered = scored
      .filter((a) => a.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 30);

    if (filtered.length < 3) continue;

    // Weighted average price
    const totalWeight = filtered.reduce((sum, a) => sum + a.similarity, 0);
    const weightedPrice = filtered.reduce(
      (sum, a) => sum + a.soldPrice * (a.similarity / totalWeight),
      0,
    );

    const prices = filtered.map((a) => a.soldPrice).sort((a, b) => a - b);
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    // Confidence based on sample size and similarity spread
    const avgSimilarity = totalWeight / filtered.length;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (filtered.length >= 10 && avgSimilarity > 0.6) confidence = 'high';
    else if (filtered.length >= 5 && avgSimilarity > 0.45) confidence = 'medium';

    // Item bonus as additive on top
    const baseEstimate = Math.round(weightedPrice);
    const itemBonus = computeItemBonus(auction.displayItems ?? null, baseEstimate);

    result[auction.id] = {
      estimatedValue: baseEstimate + itemBonus,
      minPrice: p25,
      maxPrice: p75 + itemBonus,
      sampleSize: filtered.length,
      itemBonus,
      confidence,
    };
  }

  return result;
}
