/**
 * Central type definitions for the RubinOT character tracking platform
 */

import type { Decimal } from '@prisma/client/runtime/library';
import type {
  Vocation,
  HighscoreCategory,
  DealScoreVariant,
  Skill,
  World,
} from '@/lib/utils/constants';

/**
 * Character model - Canonical record of a character
 */
export interface Character {
  id: number;
  name: string;
  worldId: number;
  vocation: string | null;
  guildName: string | null;
  firstSeen: Date;
  lastUpdated: Date;
  world?: World;
  characterSnapshots?: CharacterSnapshot[];
}

/**
 * Daily snapshot of character stats
 */
export interface CharacterSnapshot {
  id: number;
  characterId: number;
  capturedDate: Date;
  level: number | null;
  experience: bigint | null;
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;
  expRank: number | null;
  mlRank: number | null;
  expGained: bigint | null;
  levelsGained: number | null;
  createdAt: Date;
  character?: Character;
}

/**
 * Character auction listing
 */
export interface Auction {
  id: number;
  externalId: string | null;
  characterName: string;
  vocation: string | null;
  level: number | null;
  world: string | null;
  magicLevel: number | null;
  skills: Record<string, number> | null;
  charmPoints: number | null;
  charms: Record<string, number> | null;
  preySlots: number | null;
  huntingSlots: number | null;
  imbuementSlots: number | null;
  outfitsCount: number | null;
  mountsCount: number | null;
  startingBid: number | null;
  currentBid: number | null;
  buyoutPrice: number | null;
  status: 'active' | 'sold' | 'closed' | 'expired';
  soldPrice: number | null;
  listedAt: Date | null;
  endsAt: Date | null;
  soldAt: Date | null;
  dealScore: Decimal | null;
  estimatedValue: number | null;
  createdAt: Date;
  updatedAt: Date;
  watchlistItems?: Watchlist[];
}

/**
 * Precomputed market statistics for different character segments
 */
export interface MarketStats {
  id: number;
  vocation: Vocation;
  levelMin: number;
  levelMax: number;
  avgPrice: Decimal | null;
  medianPrice: Decimal | null;
  minPrice: number | null;
  maxPrice: number | null;
  pricePerLevel: Decimal | null;
  pricePerMl: Decimal | null;
  charmPointValue: Decimal | null;
  sampleSize: number | null;
  calculatedAt: Date;
}

/**
 * World information
 */
export interface WorldInfo {
  id: number;
  name: World;
  pvpType: string | null;
  isActive: boolean;
  createdAt: Date;
  characters?: Character[];
}

/**
 * Watchlist item for tracking auctions
 */
export interface Watchlist {
  id: number;
  userId: string | null;
  characterName: string | null;
  auctionId: number | null;
  notifyOnChange: boolean;
  createdAt: Date;
  auction?: Auction;
}

/**
 * API Response wrapper for consistent response format
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

/**
 * Character with latest snapshot data
 */
export interface CharacterWithLatestSnapshot extends Character {
  latestSnapshot: CharacterSnapshot | null;
}

/**
 * Character comparison for analytics
 */
export interface CharacterProgress {
  character: Character;
  currentSnapshot: CharacterSnapshot;
  previousSnapshot: CharacterSnapshot | null;
  gainedExp: bigint | null;
  gainedLevels: number | null;
  gainedMagicLevel: number | null;
  gainedSkillPoints: Record<Skill, number>;
}

/**
 * Market price insights
 */
export interface PriceInsight {
  vocation: Vocation;
  levelRange: `${number}-${number}`;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  pricePerLevel: number;
  pricePerMl: number;
  charmPointValue: number;
  sampleSize: number;
  lastUpdated: Date;
}

/**
 * Auction with calculated deal information
 */
export interface AuctionWithDealInfo extends Auction {
  dealInfo: {
    score: number;
    variant: DealScoreVariant;
    label: string;
    estimatedMarketValue: number;
    savingsAmount: number;
    savingsPercent: number;
  };
}

/**
 * Character filter parameters
 */
export interface CharacterFilterParams {
  world?: World;
  vocation?: Vocation;
  minLevel?: number;
  maxLevel?: number;
  guildName?: string;
  search?: string;
}

/**
 * Auction filter parameters
 */
export interface AuctionFilterParams {
  status?: 'active' | 'sold' | 'closed' | 'expired';
  vocation?: Vocation;
  minLevel?: number;
  maxLevel?: number;
  minPrice?: number;
  maxPrice?: number;
  world?: World;
  dealScoreMin?: number;
  dealScoreMax?: number;
}

/**
 * Highscore entry
 */
export interface HighscoreEntry {
  rank: number;
  characterName: string;
  world: World;
  vocation: Vocation;
  score: number | bigint;
  level?: number;
}

/**
 * Highscore list for a specific category
 */
export interface HighscoreList {
  category: HighscoreCategory;
  world: World;
  entries: HighscoreEntry[];
  lastUpdated: Date;
}

/**
 * Scraper job status
 */
export interface ScraperJobStatus {
  id: string;
  type: 'characters' | 'auctions' | 'highscores' | 'worlds';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  itemsProcessed: number;
  itemsFailed: number;
  error?: string;
}

/**
 * Auction estimation request
 */
export interface AuctionEstimationRequest {
  vocation: Vocation;
  level: number;
  magicLevel?: number;
  skills?: Record<Skill, number>;
  charmPoints?: number;
  preySlots?: number;
  huntingSlots?: number;
  imbuementSlots?: number;
  outfitsCount?: number;
  mountsCount?: number;
}

/**
 * Auction estimation result
 */
export interface AuctionEstimation {
  estimatedValue: number;
  priceRange: {
    min: number;
    max: number;
  };
  priceBreakdown: {
    basePrice: number;
    levelBonus: number;
    magicLevelBonus: number;
    skillsBonus: number;
    charmPointsBonus: number;
  };
  comparison: {
    meanPrice: number;
    medianPrice: number;
    percentileRank: number;
  };
}

/**
 * Bulk character update payload
 */
export interface BulkCharacterUpdatePayload {
  characterId: number;
  level: number;
  experience: bigint;
  magicLevel: number;
  skills: Record<Skill, number>;
  expRank?: number;
  mlRank?: number;
  capturedDate: Date;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalCharacters: number;
  totalSnapshots: number;
  totalAuctions: number;
  activeAuctions: number;
  worldBreakdown: Record<World, number>;
  vocationBreakdown: Record<Vocation, number>;
  lastScrapedAt: Date;
  nextScheduledScrape: Date;
}
