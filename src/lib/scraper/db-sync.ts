/**
 * Database synchronization utilities for scraper
 * Handles upserting characters and creating daily snapshots
 */

import { prisma } from '@/lib/db/prisma';
import type { HighscoreEntry } from '@/types';
import type { World, Vocation } from '@/lib/utils/constants';

/**
 * Upsert a character to the database
 * Creates new character or updates existing one
 */
export async function upsertCharacter(data: HighscoreEntry) {
  // First, ensure the world exists in the database
  const world = await prisma.world.upsert({
    where: { name: data.world },
    update: {},
    create: {
      name: data.world,
      pvpType: null, // Can be updated later
      isActive: true,
    },
  });

  // Upsert the character
  const character = await prisma.character.upsert({
    where: {
      name_worldId: {
        name: data.characterName,
        worldId: world.id,
      },
    },
    update: {
      vocation: data.vocation,
      lastUpdated: new Date(),
    },
    create: {
      name: data.characterName,
      worldId: world.id,
      vocation: data.vocation,
      guildName: null, // Can be populated from character page scrape
    },
  });

  return character;
}

/**
 * Create a daily snapshot for a character
 * Stores their current stats and ranking
 */
export async function createSnapshot(
  characterId: number,
  data: HighscoreEntry,
  date: Date
): Promise<void> {
  // Calculate experience gained since yesterday
  const expGained = await calculateExpGained(
    characterId,
    typeof data.score === 'bigint' ? data.score : BigInt(data.score)
  );

  // Calculate levels gained since yesterday
  const levelsGained = await calculateLevelsGained(characterId, data.level || 0);

  // Determine which field to populate based on the data
  const snapshotData: any = {
    characterId,
    capturedDate: date,
    level: data.level || null,
    experience: typeof data.score === 'bigint' ? data.score : BigInt(data.score),
    expRank: data.rank,
    expGained,
    levelsGained,
    createdAt: new Date(),
  };

  // Upsert the snapshot (prevent duplicates for same day)
  await prisma.characterSnapshot.upsert({
    where: {
      characterId_capturedDate: {
        characterId,
        capturedDate: date,
      },
    },
    update: snapshotData,
    create: snapshotData,
  });
}

/**
 * Create a skill-based snapshot for a character
 * Used for magic level, fist, club, sword, axe, distance, shielding, fishing
 */
export async function createSkillSnapshot(
  characterId: number,
  skillName: 'magicLevel' | 'fist' | 'club' | 'sword' | 'axe' | 'distance' | 'shielding' | 'fishing',
  skillValue: number,
  rank: number,
  date: Date
): Promise<void> {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  // Check if snapshot exists for today
  const existingSnapshot = await prisma.characterSnapshot.findUnique({
    where: {
      characterId_capturedDate: {
        characterId,
        capturedDate: today,
      },
    },
  });

  const updateData: any = {
    [skillName]: skillValue,
  };

  // Set rank field based on skill type
  if (skillName === 'magicLevel') {
    updateData.mlRank = rank;
  }

  if (existingSnapshot) {
    // Update existing snapshot with skill data
    await prisma.characterSnapshot.update({
      where: { id: existingSnapshot.id },
      data: updateData,
    });
  } else {
    // Create new snapshot with skill data
    await prisma.characterSnapshot.create({
      data: {
        characterId,
        capturedDate: today,
        ...updateData,
        createdAt: new Date(),
      },
    });
  }
}

/**
 * Calculate experience gained since yesterday
 * Returns 0n if no previous snapshot exists
 */
export async function calculateExpGained(
  characterId: number,
  currentExp: bigint
): Promise<bigint> {
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Find yesterday's snapshot
  const previousSnapshot = await prisma.characterSnapshot.findUnique({
    where: {
      characterId_capturedDate: {
        characterId,
        capturedDate: yesterday,
      },
    },
    select: {
      experience: true,
    },
  });

  if (!previousSnapshot || !previousSnapshot.experience) {
    return BigInt(0); // No previous data, so no gain to calculate
  }

  const gained = currentExp - previousSnapshot.experience;
  return gained > BigInt(0) ? gained : BigInt(0); // Only return positive gains
}

/**
 * Calculate levels gained since yesterday
 * Returns 0 if no previous snapshot exists
 */
async function calculateLevelsGained(
  characterId: number,
  currentLevel: number
): Promise<number> {
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Find yesterday's snapshot
  const previousSnapshot = await prisma.characterSnapshot.findUnique({
    where: {
      characterId_capturedDate: {
        characterId,
        capturedDate: yesterday,
      },
    },
    select: {
      level: true,
    },
  });

  if (!previousSnapshot || !previousSnapshot.level) {
    return 0; // No previous data
  }

  const gained = currentLevel - previousSnapshot.level;
  return gained > 0 ? gained : 0; // Only return positive gains
}

/**
 * Check if we've already scraped today
 * Returns true if today's snapshots exist for at least one world
 */
export async function hasScrapedToday(): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.characterSnapshot.count({
    where: {
      capturedDate: today,
    },
  });

  return count > 0;
}

/**
 * Get total characters tracked
 */
export async function getTotalCharactersTracked(): Promise<number> {
  return await prisma.character.count();
}

/**
 * Get total snapshots created today
 */
export async function getSnapshotsCreatedToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await prisma.characterSnapshot.count({
    where: {
      capturedDate: today,
    },
  });
}

/**
 * Upsert an auction to the database
 * Creates new auction or updates existing one based on externalId
 */
export async function upsertAuction(data: {
  externalId: string;
  characterName: string;
  vocation?: string | null;
  level?: number | null;
  world?: string | null;
  magicLevel?: number | null;
  fist?: number | null;
  club?: number | null;
  sword?: number | null;
  axe?: number | null;
  distance?: number | null;
  shielding?: number | null;
  fishing?: number | null;
  availableCharmPoints?: number | null;
  spentCharmPoints?: number | null;
  charms?: object | null;
  preySlots?: number | null;
  preyWildcards?: number | null;
  huntingSlots?: number | null;
  imbuementSlots?: number | null;
  outfitsCount?: number | null;
  mountsCount?: number | null;
  hirelings?: number | null;
  hirelingJobs?: number | null;
  hirelingOutfits?: number | null;
  dailyRewardStreak?: number | null;
  exaltedDust?: number | null;
  exaltedDustLimit?: number | null;
  bossPoints?: number | null;
  completedQuestLines?: string[] | null;
  startingBid?: number | null;
  currentBid?: number | null;
  buyoutPrice?: number | null;
  status?: string;
  soldPrice?: number | null;
  listedAt?: Date | null;
  endsAt?: Date | null;
  soldAt?: Date | null;
}) {
  const auction = await prisma.auction.upsert({
    where: {
      externalId: data.externalId,
    },
    update: {
      characterName: data.characterName,
      vocation: data.vocation,
      level: data.level,
      world: data.world,
      magicLevel: data.magicLevel,
      fist: data.fist,
      club: data.club,
      sword: data.sword,
      axe: data.axe,
      distance: data.distance,
      shielding: data.shielding,
      fishing: data.fishing,
      availableCharmPoints: data.availableCharmPoints,
      spentCharmPoints: data.spentCharmPoints,
      charms: data.charms ?? undefined,
      preySlots: data.preySlots,
      preyWildcards: data.preyWildcards,
      huntingSlots: data.huntingSlots,
      imbuementSlots: data.imbuementSlots,
      outfitsCount: data.outfitsCount,
      mountsCount: data.mountsCount,
      hirelings: data.hirelings,
      hirelingJobs: data.hirelingJobs,
      hirelingOutfits: data.hirelingOutfits,
      dailyRewardStreak: data.dailyRewardStreak,
      exaltedDust: data.exaltedDust,
      exaltedDustLimit: data.exaltedDustLimit,
      bossPoints: data.bossPoints,
      completedQuestLines: data.completedQuestLines ?? undefined,
      startingBid: data.startingBid,
      currentBid: data.currentBid,
      buyoutPrice: data.buyoutPrice,
      status: data.status || 'active',
      soldPrice: data.soldPrice,
      listedAt: data.listedAt,
      endsAt: data.endsAt,
      soldAt: data.soldAt,
      updatedAt: new Date(),
    },
    create: {
      externalId: data.externalId,
      characterName: data.characterName,
      vocation: data.vocation,
      level: data.level,
      world: data.world,
      magicLevel: data.magicLevel,
      fist: data.fist,
      club: data.club,
      sword: data.sword,
      axe: data.axe,
      distance: data.distance,
      shielding: data.shielding,
      fishing: data.fishing,
      availableCharmPoints: data.availableCharmPoints,
      spentCharmPoints: data.spentCharmPoints,
      charms: data.charms ?? undefined,
      preySlots: data.preySlots,
      preyWildcards: data.preyWildcards,
      huntingSlots: data.huntingSlots,
      imbuementSlots: data.imbuementSlots,
      outfitsCount: data.outfitsCount,
      mountsCount: data.mountsCount,
      hirelings: data.hirelings,
      hirelingJobs: data.hirelingJobs,
      hirelingOutfits: data.hirelingOutfits,
      dailyRewardStreak: data.dailyRewardStreak,
      exaltedDust: data.exaltedDust,
      exaltedDustLimit: data.exaltedDustLimit,
      bossPoints: data.bossPoints,
      completedQuestLines: data.completedQuestLines ?? undefined,
      startingBid: data.startingBid,
      currentBid: data.currentBid,
      buyoutPrice: data.buyoutPrice,
      status: data.status || 'active',
      soldPrice: data.soldPrice,
      listedAt: data.listedAt,
      endsAt: data.endsAt,
      soldAt: data.soldAt,
    },
  });

  return auction;
}

/**
 * Get total auctions in database
 */
export async function getTotalAuctions(): Promise<number> {
  return await prisma.auction.count();
}

/**
 * Get auctions count by status
 */
export async function getAuctionsByStatus(): Promise<Record<string, number>> {
  const results = await prisma.auction.groupBy({
    by: ['status'],
    _count: true,
  });

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.status] = r._count;
  }
  return counts;
}
