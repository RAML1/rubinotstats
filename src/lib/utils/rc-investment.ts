// Rubinot Store RC (Rubini Coins) price tables and TC investment calculator

// --- Fixed-cost store features ---

export const RC_PRICES = {
  charmExpansion: 190,
  extraPreySlot: 390,
  weeklyTaskExpansion: 390,
  lootPouch: 390,
  hirelingBase: 150,     // per hireling
  hirelingJobStandard: 250, // per job (first 3)
  hirelingJob4th: 900,   // 4th job premium
  defaultOutfit: 300,    // conservative default per outfit
  defaultMount: 220,     // conservative default per mount
} as const;

// --- Hireling job value (tiered) ---

function hirelingsJobValue(jobs: number): number {
  if (jobs <= 0) return 0;
  if (jobs <= 3) return jobs * RC_PRICES.hirelingJobStandard;
  // 4th job costs 900
  return 3 * RC_PRICES.hirelingJobStandard + RC_PRICES.hirelingJob4th;
}

// --- Main calculation ---

export interface RcInvestmentInput {
  charmExpansion: boolean | null;
  preySlots: number | null;
  weeklyTaskExpansion: boolean | null;
  hasLootPouch: boolean | null;
  hirelings: number | null;
  hirelingJobs: number | null;
  outfitsCount: number | null;
  mountsCount: number | null;
}

export interface RcInvestmentResult {
  total: number;
  breakdown: {
    charmExpansion: number;
    extraPreySlot: number;
    weeklyTaskExpansion: number;
    lootPouch: number;
    hirelings: number;
    outfits: number;
    mounts: number;
  };
}

export function calculateRcInvested(auction: RcInvestmentInput): RcInvestmentResult {
  const charmExpansion = auction.charmExpansion ? RC_PRICES.charmExpansion : 0;
  const extraPreySlot = (auction.preySlots || 0) >= 3 ? RC_PRICES.extraPreySlot : 0;
  const weeklyTaskExpansion = auction.weeklyTaskExpansion ? RC_PRICES.weeklyTaskExpansion : 0;
  const lootPouch = auction.hasLootPouch ? RC_PRICES.lootPouch : 0;

  const hirelingCount = auction.hirelings || 0;
  const hirelingJobCount = auction.hirelingJobs || 0;
  const hirelings = (hirelingCount * RC_PRICES.hirelingBase) + hirelingsJobValue(hirelingJobCount);

  const outfits = (auction.outfitsCount || 0) * RC_PRICES.defaultOutfit;
  const mounts = (auction.mountsCount || 0) * RC_PRICES.defaultMount;

  const total = charmExpansion + extraPreySlot + weeklyTaskExpansion + lootPouch + hirelings + outfits + mounts;

  return {
    total,
    breakdown: {
      charmExpansion,
      extraPreySlot,
      weeklyTaskExpansion,
      lootPouch,
      hirelings,
      outfits,
      mounts,
    },
  };
}
