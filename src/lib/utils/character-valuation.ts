import prisma from '@/lib/db/prisma';

// ── Types ──────────────────────────────────────────────────────────────

export interface CharacterStats {
  level: number;
  vocation: string;
  magicLevel?: number | null;
  skills?: {
    fist?: number | null;
    club?: number | null;
    sword?: number | null;
    axe?: number | null;
    distance?: number | null;
    shielding?: number | null;
    fishing?: number | null;
  };
  charmPoints?: number | null;
  quests?: {
    primalOrdeal?: boolean | null;
    soulWar?: boolean | null;
    sanguineBlood?: boolean | null;
  };
  mountsCount?: number | null;
  outfitsCount?: number | null;
  bossPoints?: number | null;
}

export interface ComparableAuction {
  externalId: string;
  characterName: string;
  level: number;
  vocation: string;
  soldPrice: number;
  similarity: number;
  url: string;
}

export interface CharacterValuation {
  estimatedValue: number;
  confidence: 'high' | 'medium' | 'low';
  range: { min: number; max: number };
  sampleSize: number;
  comparables: ComparableAuction[];
  factors: {
    level: number;
    magicLevel: number;
    primarySkill: number;
    charm: number;
    quests: number;
    extras: number;
  };
}

// ── Vocation helpers ───────────────────────────────────────────────────

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

/** Which skill matters most for each vocation family */
const PRIMARY_SKILL: Record<string, string> = {
  Knight: 'sword', // or axe/club, but sword is most common
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

// ── Similarity scoring ─────────────────────────────────────────────────

const WEIGHTS = {
  level: 0.35,
  magicLevel: 0.20,
  primarySkill: 0.15,
  charm: 0.10,
  quests: 0.10,
  extras: 0.10,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function proximityScore(a: number | null | undefined, b: number | null | undefined, maxDiff: number): number {
  if (a == null || b == null) return 0.5; // neutral if missing
  return clamp(1 - Math.abs(a - b) / maxDiff, 0, 1);
}

interface AuctionRow {
  external_id: string;
  character_name: string;
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
  fishing: number | null;
  charm_points: number | null;
  primal_ordeal_available: boolean | null;
  soul_war_available: boolean | null;
  sanguine_blood_available: boolean | null;
  mounts_count: number | null;
  outfits_count: number | null;
  boss_points: number | null;
  url: string;
}

function computeSimilarity(target: CharacterStats, auction: AuctionRow): number {
  const family = getVocationFamily(target.vocation);
  const primarySkillField = PRIMARY_SKILL[family] || 'magicLevel';

  // Level proximity (within ±200 levels)
  const levelScore = proximityScore(target.level, auction.level, 200);

  // Magic level proximity
  const mlScore = proximityScore(target.magicLevel, auction.magic_level, 50);

  // Primary skill proximity
  let primaryScore = 0.5;
  if (primarySkillField === 'magicLevel') {
    primaryScore = mlScore; // already computed
  } else {
    const targetSkill = target.skills?.[primarySkillField as keyof typeof target.skills];
    const auctionSkill = auction[primarySkillField as keyof AuctionRow] as number | null;
    primaryScore = proximityScore(targetSkill, auctionSkill, 30);
  }

  // Charm points proximity
  const charmScore = proximityScore(target.charmPoints, auction.charm_points, 5000);

  // Quest matching (bonus for matching quest availability)
  let questScore = 0.5;
  if (target.quests) {
    let matches = 0;
    let total = 0;
    if (target.quests.primalOrdeal != null && auction.primal_ordeal_available != null) {
      matches += target.quests.primalOrdeal === auction.primal_ordeal_available ? 1 : 0;
      total++;
    }
    if (target.quests.soulWar != null && auction.soul_war_available != null) {
      matches += target.quests.soulWar === auction.soul_war_available ? 1 : 0;
      total++;
    }
    if (target.quests.sanguineBlood != null && auction.sanguine_blood_available != null) {
      matches += target.quests.sanguineBlood === auction.sanguine_blood_available ? 1 : 0;
      total++;
    }
    if (total > 0) questScore = matches / total;
  }

  // Extras (mounts, outfits, boss points)
  const mountScore = proximityScore(target.mountsCount, auction.mounts_count, 100);
  const outfitScore = proximityScore(target.outfitsCount, auction.outfits_count, 100);
  const bossScore = proximityScore(target.bossPoints, auction.boss_points, 10000);
  const extrasScore = (mountScore + outfitScore + bossScore) / 3;

  return (
    WEIGHTS.level * levelScore +
    WEIGHTS.magicLevel * mlScore +
    WEIGHTS.primarySkill * primaryScore +
    WEIGHTS.charm * charmScore +
    WEIGHTS.quests * questScore +
    WEIGHTS.extras * extrasScore
  );
}

// ── Main valuation function ────────────────────────────────────────────

export async function estimateCharacterValue(stats: CharacterStats): Promise<CharacterValuation | null> {
  const family = getVocationFamily(stats.vocation);
  const vocations = getFamilyVocations(family);
  const levelMin = Math.max(1, stats.level - 200);
  const levelMax = stats.level + 200;

  // Query sold auctions matching vocation family + level range
  const rows = await prisma.$queryRaw<AuctionRow[]>`
    SELECT
      external_id, character_name, level, vocation, sold_price,
      magic_level, fist, club, sword, axe, distance, shielding, fishing,
      charm_points, primal_ordeal_available, soul_war_available, sanguine_blood_available,
      mounts_count, outfits_count, boss_points, url
    FROM auctions
    WHERE auction_status = 'sold'
      AND sold_price > 0
      AND level BETWEEN ${levelMin} AND ${levelMax}
      AND vocation = ANY(${vocations})
    ORDER BY ABS(level - ${stats.level}) ASC
    LIMIT 200
  `;

  if (rows.length < 3) return null;

  // Score each auction by similarity
  const scored = rows.map(row => ({
    ...row,
    similarity: computeSimilarity(stats, row),
  }));

  // Filter by minimum similarity and take top 20
  const filtered = scored
    .filter(a => a.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20);

  if (filtered.length < 3) return null;

  // Weighted average price
  const totalWeight = filtered.reduce((sum, a) => sum + a.similarity, 0);
  const weightedPrice = filtered.reduce(
    (sum, a) => sum + a.sold_price * (a.similarity / totalWeight),
    0,
  );

  const prices = filtered.map(a => a.sold_price).sort((a, b) => a - b);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const p25 = prices[Math.floor(prices.length * 0.25)];
  const p75 = prices[Math.floor(prices.length * 0.75)];

  // Confidence based on sample size and similarity spread
  const avgSimilarity = totalWeight / filtered.length;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (filtered.length >= 10 && avgSimilarity > 0.6) confidence = 'high';
  else if (filtered.length >= 5 && avgSimilarity > 0.45) confidence = 'medium';

  // Top 5 most similar for display
  const comparables: ComparableAuction[] = filtered.slice(0, 5).map(a => ({
    externalId: a.external_id,
    characterName: a.character_name,
    level: a.level,
    vocation: a.vocation,
    soldPrice: a.sold_price,
    similarity: Math.round(a.similarity * 100),
    url: a.url,
  }));

  return {
    estimatedValue: Math.round(weightedPrice),
    confidence,
    range: { min: p25, max: p75 },
    sampleSize: filtered.length,
    comparables,
    factors: WEIGHTS,
  };
}
