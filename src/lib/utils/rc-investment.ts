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
} as const;

// --- Known expensive store outfits (from Rubinot store screenshots) ---
// Only these are counted — quest/free outfits are ignored

export const STORE_OUTFIT_PRICES: Record<string, number> = {
  'Dragon Slayer': 1690,
  'Royal Costume': 2490,
  'Void Master': 990,
  'Veteran Paladin': 990,
  'Lion of War': 990,
  'Battle Mage': 790,
};

// --- Known expensive store mounts (from Rubinot store screenshots) ---

export const STORE_MOUNT_PRICES: Record<string, number> = {
  'Fleeting Knowledge': 990,
  'Jousting Eagle': 890,
  'Cerberus Champion': 890,
  'Rubini Skull': 590,
  'Chaotic Skull': 590,
  'Darkfire Devourer': 590,
};

// --- Hireling job value (tiered) ---

function hirelingsJobValue(jobs: number): number {
  if (jobs <= 0) return 0;
  if (jobs <= 3) return jobs * RC_PRICES.hirelingJobStandard;
  // 4th job costs 900
  return 3 * RC_PRICES.hirelingJobStandard + RC_PRICES.hirelingJob4th;
}

// --- Name matching helpers ---

function matchOutfitPrice(outfitEntry: string): number {
  // Outfit entries look like "Dragon Slayer (Full Outfit)" or "Dragon Slayer (Base)"
  for (const [name, price] of Object.entries(STORE_OUTFIT_PRICES)) {
    if (outfitEntry.toLowerCase().includes(name.toLowerCase())) {
      return price;
    }
  }
  return 0;
}

function matchMountPrice(mountName: string): number {
  for (const [name, price] of Object.entries(STORE_MOUNT_PRICES)) {
    if (mountName.toLowerCase().includes(name.toLowerCase())) {
      return price;
    }
  }
  return 0;
}

// --- Main calculation ---

export interface RcInvestmentInput {
  charmExpansion: boolean | null;
  preySlots: number | null;
  weeklyTaskExpansion: boolean | null;
  hasLootPouch: boolean | null;
  hirelings: number | null;
  hirelingJobs: number | null;
  outfitNames: string | null;  // JSON array of outfit name strings
  mountNames: string | null;   // JSON array of mount name strings
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
  matchedOutfits: { name: string; price: number }[];
  matchedMounts: { name: string; price: number }[];
}

export function calculateRcInvested(auction: RcInvestmentInput): RcInvestmentResult {
  const charmExpansion = auction.charmExpansion ? RC_PRICES.charmExpansion : 0;
  const extraPreySlot = (auction.preySlots || 0) >= 3 ? RC_PRICES.extraPreySlot : 0;
  const weeklyTaskExpansion = auction.weeklyTaskExpansion ? RC_PRICES.weeklyTaskExpansion : 0;
  const lootPouch = auction.hasLootPouch ? RC_PRICES.lootPouch : 0;

  const hirelingCount = auction.hirelings || 0;
  const hirelingJobCount = auction.hirelingJobs || 0;
  const hirelings = (hirelingCount * RC_PRICES.hirelingBase) + hirelingsJobValue(hirelingJobCount);

  // Match individual outfit names against known store outfits
  const matchedOutfits: { name: string; price: number }[] = [];
  if (auction.outfitNames) {
    try {
      const names: string[] = JSON.parse(auction.outfitNames);
      for (const entry of names) {
        const price = matchOutfitPrice(entry);
        if (price > 0) {
          matchedOutfits.push({ name: entry, price });
        }
      }
    } catch { /* invalid JSON — skip */ }
  }
  const outfits = matchedOutfits.reduce((sum, o) => sum + o.price, 0);

  // Match individual mount names against known store mounts
  const matchedMounts: { name: string; price: number }[] = [];
  if (auction.mountNames) {
    try {
      const names: string[] = JSON.parse(auction.mountNames);
      for (const entry of names) {
        const price = matchMountPrice(entry);
        if (price > 0) {
          matchedMounts.push({ name: entry, price });
        }
      }
    } catch { /* invalid JSON — skip */ }
  }
  const mounts = matchedMounts.reduce((sum, m) => sum + m.price, 0);

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
    matchedOutfits,
    matchedMounts,
  };
}
