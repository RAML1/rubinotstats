/**
 * Mock data for RubinOT Stats POC
 * Contains sample character data, historical snapshots, auction data, and market stats
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Character profile data
 */
export interface MockCharacter {
  id: number;
  name: string;
  level: number;
  vocation: string;
  world: string;
  guild: string | null;
  rank: number;
  experience: bigint;
  firstSeen: Date;
  lastUpdated: Date;
}

/**
 * Historical snapshot for tracking progression
 */
export interface MockCharacterSnapshot {
  id: number;
  characterId: number;
  capturedDate: Date;
  level: number;
  experience: bigint;
  expGained: bigint;
  levelsGained: number;
  magicLevel: number;
  fist: number;
  club: number;
  sword: number;
  axe: number;
  distance: number;
  shielding: number;
  fishing: number;
  expRank: number | null;
  mlRank: number | null;
}

/**
 * Skill data structure for auctions
 */
export interface AuctionSkills {
  magicLevel: number;
  shielding: number;
  fist: number;
  club: number;
  sword: number;
  axe: number;
  distance: number;
  fishing: number;
}

/**
 * Character auction listing
 */
export interface MockAuction {
  id: number;
  externalId: string;
  name: string;
  level: number;
  vocation: string;
  world: string;
  gender: 'male' | 'female';
  auctionStart: Date;
  auctionEnd: Date;
  currentBid: number;
  startingBid: number;
  buyoutPrice: number | null;
  status: 'active' | 'sold' | 'closed' | 'expired';
  soldPrice: number | null;
  skills: AuctionSkills;
  charmPoints: number;
  bossPoints: number;
  goldTotal: number;
  preySlots: number;
  huntingSlots: number;
  imbuementSlots: number;
  outfitsCount: number;
  mountsCount: number;
}

/**
 * Market statistics for price trends
 */
export interface MockMarketStats {
  id: number;
  vocation: string;
  levelMin: number;
  levelMax: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  pricePerLevel: number;
  pricePerMl: number;
  charmPointValue: number;
  sampleSize: number;
  calculatedAt: Date;
}

/**
 * Price trend data point
 */
export interface PriceTrendPoint {
  date: Date;
  avgPrice: number;
  volume: number;
  minPrice: number;
  maxPrice: number;
}

// ============================================================================
// Super Bonk Lee - Real Character Data
// ============================================================================

export const superBonkLee: MockCharacter = {
  id: 1,
  name: 'Super Bonk Lee',
  level: 777,
  vocation: 'Exalted Monk',
  world: 'Auroria',
  guild: 'No Name',
  rank: 77,
  experience: BigInt(7786993479),
  firstSeen: new Date('2024-01-15'),
  lastUpdated: new Date(),
};

// ============================================================================
// Historical Snapshots for Super Bonk Lee (30 days of progression)
// ============================================================================

/**
 * Generate realistic exp gains for a high-level Monk
 * Daily exp gain varies based on hunting patterns
 */
function generateSuperBonkLeeSnapshots(): MockCharacterSnapshot[] {
  const snapshots: MockCharacterSnapshot[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30);

  // Starting values (30 days ago)
  let currentExp = BigInt(7550000000); // Started lower
  let currentLevel = 765;
  let currentMl = 45;

  // Experience thresholds roughly follow Tibia formula
  const getExpForLevel = (level: number): bigint => {
    return BigInt(Math.floor((50 * (level - 1) * (level - 1) * (level - 1) - 150 * (level - 1) * (level - 1) + 400 * (level - 1)) / 3));
  };

  for (let day = 0; day < 30; day++) {
    const snapshotDate = new Date(baseDate);
    snapshotDate.setDate(snapshotDate.getDate() + day);

    // Realistic daily exp gain (varies between 5M and 25M based on hunting activity)
    const isWeekend = snapshotDate.getDay() === 0 || snapshotDate.getDay() === 6;
    const baseGain = isWeekend ? 18000000 : 12000000;
    const variance = Math.floor(Math.random() * 8000000) - 4000000;
    const dailyExpGain = BigInt(Math.max(5000000, baseGain + variance));

    // Some days might have very low activity
    const isLowActivityDay = Math.random() < 0.15;
    const actualGain = isLowActivityDay ? BigInt(Math.floor(Number(dailyExpGain) * 0.2)) : dailyExpGain;

    currentExp += actualGain;

    // Check for level ups
    let levelsGained = 0;
    while (currentExp >= getExpForLevel(currentLevel + 1)) {
      currentLevel++;
      levelsGained++;
      // Small chance of ML gain on level up
      if (Math.random() < 0.3) {
        currentMl++;
      }
    }

    snapshots.push({
      id: day + 1,
      characterId: 1,
      capturedDate: snapshotDate,
      level: currentLevel,
      experience: currentExp,
      expGained: actualGain,
      levelsGained,
      magicLevel: currentMl,
      fist: 120,
      club: 130,
      sword: 125,
      axe: 128,
      distance: 45,
      shielding: 115,
      fishing: 30,
      expRank: 77 - Math.floor(day / 5), // Slowly climbing ranks
      mlRank: null,
    });
  }

  // Ensure final snapshot matches the real data
  if (snapshots.length > 0) {
    const lastSnapshot = snapshots[snapshots.length - 1];
    lastSnapshot.level = 777;
    lastSnapshot.experience = BigInt(7786993479);
    lastSnapshot.expRank = 77;
  }

  return snapshots;
}

export const superBonkLeeSnapshots: MockCharacterSnapshot[] = generateSuperBonkLeeSnapshots();

// ============================================================================
// Mock Monk Auctions
// ============================================================================

const now = new Date();
const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

export const mockMonkAuctions: MockAuction[] = [
  {
    id: 1001,
    externalId: 'MONK-AUC-001',
    name: 'Sensei Hiroshi',
    level: 450,
    vocation: 'Exalted Monk',
    world: 'Auroria',
    gender: 'male',
    auctionStart: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    auctionEnd: oneWeekFromNow,
    currentBid: 1250,
    startingBid: 800,
    buyoutPrice: 2500,
    status: 'active',
    soldPrice: null,
    skills: {
      magicLevel: 38,
      shielding: 105,
      fist: 118,
      club: 125,
      sword: 110,
      axe: 108,
      distance: 35,
      fishing: 25,
    },
    charmPoints: 4500,
    bossPoints: 12500,
    goldTotal: 2500000,
    preySlots: 3,
    huntingSlots: 3,
    imbuementSlots: 3,
    outfitsCount: 45,
    mountsCount: 32,
  },
  {
    id: 1002,
    externalId: 'MONK-AUC-002',
    name: 'Martial Master Yuki',
    level: 320,
    vocation: 'Exalted Monk',
    world: 'Elysian',
    gender: 'female',
    auctionStart: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    auctionEnd: twoDaysFromNow,
    currentBid: 580,
    startingBid: 500,
    buyoutPrice: 1200,
    status: 'active',
    soldPrice: null,
    skills: {
      magicLevel: 32,
      shielding: 95,
      fist: 108,
      club: 112,
      sword: 98,
      axe: 96,
      distance: 28,
      fishing: 20,
    },
    charmPoints: 2800,
    bossPoints: 8500,
    goldTotal: 1200000,
    preySlots: 2,
    huntingSlots: 2,
    imbuementSlots: 2,
    outfitsCount: 28,
    mountsCount: 18,
  },
];

// ============================================================================
// Real Sample Auctions (from scraped data)
// ============================================================================

export const realSampleAuctions: MockAuction[] = [
  {
    id: 2001,
    externalId: 'REAL-AUC-001',
    name: 'Freya de Rivia',
    level: 415,
    vocation: 'Elite Knight',
    world: 'Elysian',
    gender: 'female',
    auctionStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    auctionEnd: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    currentBid: 590,
    startingBid: 400,
    buyoutPrice: 1500,
    status: 'active',
    soldPrice: null,
    skills: {
      magicLevel: 12,
      shielding: 112,
      fist: 25,
      club: 115,
      sword: 118,
      axe: 110,
      distance: 22,
      fishing: 18,
    },
    charmPoints: 3200,
    bossPoints: 9800,
    goldTotal: 1800000,
    preySlots: 3,
    huntingSlots: 3,
    imbuementSlots: 3,
    outfitsCount: 52,
    mountsCount: 38,
  },
  {
    id: 2002,
    externalId: 'REAL-AUC-002',
    name: 'Paumandado',
    level: 828,
    vocation: 'Elite Knight',
    world: 'Auroria',
    gender: 'male',
    auctionStart: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    auctionEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    currentBid: 601,
    startingBid: 500,
    buyoutPrice: 2000,
    status: 'active',
    soldPrice: null,
    skills: {
      magicLevel: 15,
      shielding: 125,
      fist: 28,
      club: 128,
      sword: 132,
      axe: 126,
      distance: 25,
      fishing: 22,
    },
    charmPoints: 8500,
    bossPoints: 25000,
    goldTotal: 5500000,
    preySlots: 3,
    huntingSlots: 3,
    imbuementSlots: 3,
    outfitsCount: 78,
    mountsCount: 55,
  },
];

// ============================================================================
// All Auctions Combined
// ============================================================================

export const allMockAuctions: MockAuction[] = [
  ...mockMonkAuctions,
  ...realSampleAuctions,
];

// ============================================================================
// Mock Market Stats for Auction Price Trends
// ============================================================================

export const mockMarketStats: MockMarketStats[] = [
  // Elite Knight brackets
  {
    id: 1,
    vocation: 'Elite Knight',
    levelMin: 100,
    levelMax: 200,
    avgPrice: 180,
    medianPrice: 150,
    minPrice: 80,
    maxPrice: 350,
    pricePerLevel: 1.2,
    pricePerMl: 8,
    charmPointValue: 0.02,
    sampleSize: 45,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 2,
    vocation: 'Elite Knight',
    levelMin: 200,
    levelMax: 400,
    avgPrice: 420,
    medianPrice: 380,
    minPrice: 200,
    maxPrice: 850,
    pricePerLevel: 1.5,
    pricePerMl: 12,
    charmPointValue: 0.03,
    sampleSize: 62,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 3,
    vocation: 'Elite Knight',
    levelMin: 400,
    levelMax: 600,
    avgPrice: 750,
    medianPrice: 680,
    minPrice: 450,
    maxPrice: 1500,
    pricePerLevel: 1.8,
    pricePerMl: 15,
    charmPointValue: 0.04,
    sampleSize: 38,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 4,
    vocation: 'Elite Knight',
    levelMin: 600,
    levelMax: 1000,
    avgPrice: 1250,
    medianPrice: 1100,
    minPrice: 700,
    maxPrice: 2500,
    pricePerLevel: 2.0,
    pricePerMl: 18,
    charmPointValue: 0.05,
    sampleSize: 22,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  // Exalted Monk brackets (custom vocation)
  {
    id: 5,
    vocation: 'Exalted Monk',
    levelMin: 100,
    levelMax: 200,
    avgPrice: 200,
    medianPrice: 175,
    minPrice: 100,
    maxPrice: 400,
    pricePerLevel: 1.3,
    pricePerMl: 10,
    charmPointValue: 0.025,
    sampleSize: 28,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 6,
    vocation: 'Exalted Monk',
    levelMin: 200,
    levelMax: 400,
    avgPrice: 520,
    medianPrice: 480,
    minPrice: 280,
    maxPrice: 950,
    pricePerLevel: 1.7,
    pricePerMl: 14,
    charmPointValue: 0.035,
    sampleSize: 42,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 7,
    vocation: 'Exalted Monk',
    levelMin: 400,
    levelMax: 600,
    avgPrice: 950,
    medianPrice: 880,
    minPrice: 550,
    maxPrice: 1800,
    pricePerLevel: 2.1,
    pricePerMl: 18,
    charmPointValue: 0.045,
    sampleSize: 25,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 8,
    vocation: 'Exalted Monk',
    levelMin: 600,
    levelMax: 1000,
    avgPrice: 1650,
    medianPrice: 1500,
    minPrice: 900,
    maxPrice: 3500,
    pricePerLevel: 2.5,
    pricePerMl: 22,
    charmPointValue: 0.06,
    sampleSize: 15,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  // Royal Paladin brackets
  {
    id: 9,
    vocation: 'Royal Paladin',
    levelMin: 100,
    levelMax: 200,
    avgPrice: 165,
    medianPrice: 140,
    minPrice: 75,
    maxPrice: 320,
    pricePerLevel: 1.1,
    pricePerMl: 7,
    charmPointValue: 0.02,
    sampleSize: 55,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 10,
    vocation: 'Royal Paladin',
    levelMin: 200,
    levelMax: 400,
    avgPrice: 380,
    medianPrice: 350,
    minPrice: 180,
    maxPrice: 780,
    pricePerLevel: 1.4,
    pricePerMl: 11,
    charmPointValue: 0.028,
    sampleSize: 68,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  // Master Sorcerer brackets
  {
    id: 11,
    vocation: 'Master Sorcerer',
    levelMin: 100,
    levelMax: 200,
    avgPrice: 220,
    medianPrice: 190,
    minPrice: 110,
    maxPrice: 450,
    pricePerLevel: 1.4,
    pricePerMl: 9,
    charmPointValue: 0.022,
    sampleSize: 48,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 12,
    vocation: 'Master Sorcerer',
    levelMin: 200,
    levelMax: 400,
    avgPrice: 550,
    medianPrice: 500,
    minPrice: 300,
    maxPrice: 1100,
    pricePerLevel: 1.8,
    pricePerMl: 15,
    charmPointValue: 0.038,
    sampleSize: 52,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  // Elder Druid brackets
  {
    id: 13,
    vocation: 'Elder Druid',
    levelMin: 100,
    levelMax: 200,
    avgPrice: 210,
    medianPrice: 185,
    minPrice: 105,
    maxPrice: 420,
    pricePerLevel: 1.35,
    pricePerMl: 8.5,
    charmPointValue: 0.021,
    sampleSize: 42,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 14,
    vocation: 'Elder Druid',
    levelMin: 200,
    levelMax: 400,
    avgPrice: 530,
    medianPrice: 480,
    minPrice: 290,
    maxPrice: 1050,
    pricePerLevel: 1.75,
    pricePerMl: 14,
    charmPointValue: 0.036,
    sampleSize: 48,
    calculatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  },
];

// ============================================================================
// Price Trend History (30 days)
// ============================================================================

function generatePriceTrends(): Record<string, PriceTrendPoint[]> {
  const vocations = ['Elite Knight', 'Exalted Monk', 'Royal Paladin', 'Master Sorcerer', 'Elder Druid'];
  const trends: Record<string, PriceTrendPoint[]> = {};

  for (const vocation of vocations) {
    const basePrice = vocation === 'Exalted Monk' ? 520 :
                      vocation === 'Elite Knight' ? 420 :
                      vocation === 'Master Sorcerer' ? 550 :
                      vocation === 'Elder Druid' ? 530 : 380;

    const points: PriceTrendPoint[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 30);

    let currentPrice = basePrice * 0.92; // Started slightly lower

    for (let day = 0; day < 30; day++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);

      // Add some market volatility
      const dailyChange = (Math.random() - 0.48) * 20; // Slight upward bias
      currentPrice = Math.max(basePrice * 0.8, Math.min(basePrice * 1.2, currentPrice + dailyChange));

      // Volume varies by day of week
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseVolume = isWeekend ? 12 : 8;
      const volume = baseVolume + Math.floor(Math.random() * 6);

      points.push({
        date,
        avgPrice: Math.round(currentPrice),
        volume,
        minPrice: Math.round(currentPrice * 0.7),
        maxPrice: Math.round(currentPrice * 1.4),
      });
    }

    trends[vocation] = points;
  }

  return trends;
}

export const priceTrends: Record<string, PriceTrendPoint[]> = generatePriceTrends();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get character by name
 */
export function getMockCharacterByName(name: string): MockCharacter | undefined {
  if (name.toLowerCase() === 'super bonk lee') {
    return superBonkLee;
  }
  return undefined;
}

/**
 * Get snapshots for a character
 */
export function getMockSnapshotsForCharacter(characterId: number): MockCharacterSnapshot[] {
  if (characterId === 1) {
    return superBonkLeeSnapshots;
  }
  return [];
}

/**
 * Get auctions by vocation
 */
export function getMockAuctionsByVocation(vocation: string): MockAuction[] {
  return allMockAuctions.filter(
    (auction) => auction.vocation.toLowerCase() === vocation.toLowerCase()
  );
}

/**
 * Get market stats by vocation and level range
 */
export function getMockMarketStats(vocation: string, level: number): MockMarketStats | undefined {
  return mockMarketStats.find(
    (stats) =>
      stats.vocation.toLowerCase() === vocation.toLowerCase() &&
      level >= stats.levelMin &&
      level <= stats.levelMax
  );
}

/**
 * Get price trends for a vocation
 */
export function getMockPriceTrends(vocation: string): PriceTrendPoint[] {
  return priceTrends[vocation] || [];
}

/**
 * Calculate exp gained over a period from snapshots
 */
export function calculateExpProgress(
  snapshots: MockCharacterSnapshot[],
  days: number = 7
): { totalExpGained: bigint; avgDailyExp: bigint; levelsGained: number } {
  const recentSnapshots = snapshots.slice(-days);

  if (recentSnapshots.length < 2) {
    return { totalExpGained: BigInt(0), avgDailyExp: BigInt(0), levelsGained: 0 };
  }

  let totalExpGained = BigInt(0);
  let totalLevelsGained = 0;

  for (const snapshot of recentSnapshots) {
    totalExpGained += snapshot.expGained;
    totalLevelsGained += snapshot.levelsGained;
  }

  const avgDailyExp = totalExpGained / BigInt(recentSnapshots.length);

  return {
    totalExpGained,
    avgDailyExp,
    levelsGained: totalLevelsGained,
  };
}

// ============================================================================
// Convenience Exports for UI Components
// ============================================================================

/**
 * Featured character for the home page (simplified format)
 */
export const featuredCharacter = {
  name: superBonkLee.name,
  level: superBonkLee.level,
  vocation: superBonkLee.vocation,
  world: superBonkLee.world,
  guild: superBonkLee.guild || 'None',
  experience: Number(superBonkLee.experience),
};

/**
 * Recent auctions for the home page (simplified format)
 */
export const recentAuctions = allMockAuctions.map((auction) => ({
  id: auction.id,
  characterName: auction.name,
  level: auction.level,
  vocation: auction.vocation,
  world: auction.world,
  currentBid: auction.currentBid,
}));

// ============================================================================
// Default Export
// ============================================================================

export default {
  superBonkLee,
  superBonkLeeSnapshots,
  mockMonkAuctions,
  realSampleAuctions,
  allMockAuctions,
  mockMarketStats,
  priceTrends,
  featuredCharacter,
  recentAuctions,
  getMockCharacterByName,
  getMockSnapshotsForCharacter,
  getMockAuctionsByVocation,
  getMockMarketStats,
  getMockPriceTrends,
  calculateExpProgress,
};
