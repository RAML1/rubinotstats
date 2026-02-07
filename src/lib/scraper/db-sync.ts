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
