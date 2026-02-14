import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// Helper to convert BigInt to Number for JSON serialization
function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return Number(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt) as T;
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeBigInt(value);
    }
    return serialized as T;
  }

  return obj;
}

// Helper to calculate date ranges for month comparisons
function getMonthRanges() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    currentMonthStart,
    lastMonthStart,
    lastMonthEnd,
  };
}

// Calculate KPIs from snapshots
function calculateKPIs(snapshots: any[]) {
  if (snapshots.length === 0) {
    return {
      currentLevel: 0,
      expGainedThisMonth: 0,
      expGainedLastMonth: 0,
      levelsGainedThisMonth: 0,
      levelsGainedLastMonth: 0,
      skillChangesThisMonth: [],
      bestDayEver: { date: null, expGained: 0 },
      bestWeekEver: { startDate: null, endDate: null, expGained: 0 },
      currentExpRank: null,
      currentMlRank: null,
    };
  }

  const latestSnapshot = snapshots[snapshots.length - 1];
  const { currentMonthStart, lastMonthStart, lastMonthEnd } = getMonthRanges();

  // Current level and ranks
  const currentLevel = latestSnapshot.level || 0;
  const currentExpRank = latestSnapshot.expRank;
  const currentMlRank = latestSnapshot.mlRank;

  // Month comparisons
  const thisMonthSnapshots = snapshots.filter(
    s => new Date(s.capturedDate) >= currentMonthStart
  );
  const lastMonthSnapshots = snapshots.filter(
    s => new Date(s.capturedDate) >= lastMonthStart && new Date(s.capturedDate) <= lastMonthEnd
  );

  const expGainedThisMonth = thisMonthSnapshots.reduce(
    (sum, s) => sum + (Number(s.expGained) || 0),
    0
  );
  const expGainedLastMonth = lastMonthSnapshots.reduce(
    (sum, s) => sum + (Number(s.expGained) || 0),
    0
  );
  const levelsGainedThisMonth = thisMonthSnapshots.reduce(
    (sum, s) => sum + (s.levelsGained || 0),
    0
  );
  const levelsGainedLastMonth = lastMonthSnapshots.reduce(
    (sum, s) => sum + (s.levelsGained || 0),
    0
  );

  // Skill changes this month
  const skillChangesThisMonth: any[] = [];
  const skillNames = ['magicLevel', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];

  if (thisMonthSnapshots.length > 0) {
    const firstSnapshotThisMonth = thisMonthSnapshots[0];

    // Find snapshot from before this month (most recent)
    const snapshotsBeforeMonth = snapshots.filter(
      s => new Date(s.capturedDate) < currentMonthStart
    );
    const lastSnapshotBeforeMonth = snapshotsBeforeMonth.length > 0
      ? snapshotsBeforeMonth[snapshotsBeforeMonth.length - 1]
      : null;

    if (lastSnapshotBeforeMonth) {
      for (const skill of skillNames) {
        const oldValue = lastSnapshotBeforeMonth[skill];
        const newValue = latestSnapshot[skill];
        if (oldValue !== null && newValue !== null && oldValue !== newValue) {
          skillChangesThisMonth.push({
            skill,
            oldValue,
            newValue,
            change: newValue - oldValue,
          });
        }
      }
    }
  }

  // Best day ever
  let bestDayEver = { date: null as Date | null, expGained: 0 };
  for (const snapshot of snapshots) {
    const expGained = Number(snapshot.expGained) || 0;
    if (expGained > bestDayEver.expGained) {
      bestDayEver = {
        date: snapshot.capturedDate,
        expGained,
      };
    }
  }

  // Best week ever (7-day rolling window)
  let bestWeekEver = { startDate: null as Date | null, endDate: null as Date | null, expGained: 0 };
  for (let i = 0; i < snapshots.length; i++) {
    const startDate = new Date(snapshots[i].capturedDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    let weekTotal = 0;
    for (let j = i; j < snapshots.length; j++) {
      const snapshotDate = new Date(snapshots[j].capturedDate);
      if (snapshotDate <= endDate) {
        weekTotal += Number(snapshots[j].expGained) || 0;
      } else {
        break;
      }
    }

    if (weekTotal > bestWeekEver.expGained) {
      bestWeekEver = {
        startDate,
        endDate,
        expGained: weekTotal,
      };
    }
  }

  return {
    currentLevel,
    expGainedThisMonth,
    expGainedLastMonth,
    levelsGainedThisMonth,
    levelsGainedLastMonth,
    skillChangesThisMonth,
    bestDayEver,
    bestWeekEver,
    currentExpRank,
    currentMlRank,
  };
}

// Derive milestones from snapshots
function deriveMilestones(snapshots: any[]) {
  const milestones: any[] = [];
  const skillNames = ['magicLevel', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
  const skillMilestoneValues = [10, 20, 50, 100];
  const levelMilestoneInterval = 50;

  // Track what we've already recorded to avoid duplicates
  const recordedLevelMilestones = new Set<number>();
  const recordedSkillMilestones = new Map<string, Set<number>>();

  for (const skill of skillNames) {
    recordedSkillMilestones.set(skill, new Set());
  }

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const previousSnapshot = i > 0 ? snapshots[i - 1] : null;

    // Level milestones (every 50 levels)
    if (snapshot.level) {
      const currentMilestone = Math.floor(snapshot.level / levelMilestoneInterval) * levelMilestoneInterval;
      const previousLevel = previousSnapshot?.level || 0;
      const previousMilestone = Math.floor(previousLevel / levelMilestoneInterval) * levelMilestoneInterval;

      if (currentMilestone > 0 && currentMilestone > previousMilestone && !recordedLevelMilestones.has(currentMilestone)) {
        milestones.push({
          type: 'level',
          value: currentMilestone,
          date: snapshot.capturedDate,
          description: `Reached level ${currentMilestone}`,
        });
        recordedLevelMilestones.add(currentMilestone);
      }
    }

    // Skill milestones
    for (const skill of skillNames) {
      const currentValue = snapshot[skill];
      const previousValue = previousSnapshot?.[skill] || 0;

      if (currentValue !== null) {
        for (const milestoneValue of skillMilestoneValues) {
          if (currentValue >= milestoneValue && previousValue < milestoneValue) {
            if (!recordedSkillMilestones.get(skill)?.has(milestoneValue)) {
              milestones.push({
                type: 'skill',
                skill,
                value: milestoneValue,
                date: snapshot.capturedDate,
                description: `${skill} reached ${milestoneValue}`,
              });
              recordedSkillMilestones.get(skill)?.add(milestoneValue);
            }
          }
        }
      }
    }

    // Rank milestones (entering top 100, 50, 10)
    const rankMilestones = [100, 50, 10];
    const previousExpRank = previousSnapshot?.expRank || 99999;
    const currentExpRank = snapshot.expRank;

    if (currentExpRank !== null) {
      for (const rankThreshold of rankMilestones) {
        if (currentExpRank <= rankThreshold && previousExpRank > rankThreshold) {
          milestones.push({
            type: 'rank',
            category: 'experience',
            value: rankThreshold,
            date: snapshot.capturedDate,
            description: `Entered top ${rankThreshold} in experience`,
          });
        }
      }
    }

    const previousMlRank = previousSnapshot?.mlRank || 99999;
    const currentMlRank = snapshot.mlRank;

    if (currentMlRank !== null) {
      for (const rankThreshold of rankMilestones) {
        if (currentMlRank <= rankThreshold && previousMlRank > rankThreshold) {
          milestones.push({
            type: 'rank',
            category: 'magic level',
            value: rankThreshold,
            date: snapshot.capturedDate,
            description: `Entered top ${rankThreshold} in magic level`,
          });
        }
      }
    }
  }

  // Sort by date descending (most recent first)
  return milestones.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const characterName = searchParams.get('characterName');
    const searchQuery = searchParams.get('q');

    // Search mode: return character name matches
    if (!characterName && searchQuery) {
      const characters = await prisma.character.findMany({
        where: {
          name: {
            contains: searchQuery,
            mode: 'insensitive',
          },
        },
        include: {
          world: true,
        },
        take: 10,
        orderBy: {
          name: 'asc',
        },
      });

      return NextResponse.json({
        success: true,
        data: characters.map(c => ({
          name: c.name,
          world: c.world.name,
          vocation: c.vocation,
        })),
      });
    }

    // Progression mode: return full character data
    if (!characterName) {
      return NextResponse.json(
        { success: false, error: 'characterName or q query parameter is required' },
        { status: 400 }
      );
    }

    // 1. Get character with world relation
    const character = await prisma.character.findFirst({
      where: {
        name: {
          equals: characterName,
          mode: 'insensitive',
        },
      },
      include: {
        world: true,
      },
    });

    if (!character) {
      return NextResponse.json(
        { success: false, error: 'Character not found' },
        { status: 404 }
      );
    }

    // 2. Get all snapshots
    const snapshots = await prisma.characterSnapshot.findMany({
      where: {
        characterId: character.id,
      },
      orderBy: {
        capturedDate: 'asc',
      },
    });

    // 3. Get highscore entries
    const highscores = await prisma.highscoreEntry.findMany({
      where: {
        characterName: {
          equals: character.name,
          mode: 'insensitive',
        },
        world: character.world.name,
      },
      orderBy: {
        capturedDate: 'asc',
      },
    });

    // 4. Get vocation averages from auctions
    let vocationAverages = null;
    if (character.vocation) {
      const auctionStats = await prisma.auction.groupBy({
        by: ['vocation'],
        where: {
          vocation: character.vocation,
        },
        _avg: {
          level: true,
          magicLevel: true,
          fist: true,
          club: true,
          sword: true,
          axe: true,
          distance: true,
          shielding: true,
          fishing: true,
          soldPrice: true,
        },
      });

      if (auctionStats.length > 0) {
        vocationAverages = {
          vocation: character.vocation,
          avgLevel: auctionStats[0]._avg.level,
          avgMagicLevel: auctionStats[0]._avg.magicLevel,
          avgFist: auctionStats[0]._avg.fist,
          avgClub: auctionStats[0]._avg.club,
          avgSword: auctionStats[0]._avg.sword,
          avgAxe: auctionStats[0]._avg.axe,
          avgDistance: auctionStats[0]._avg.distance,
          avgShielding: auctionStats[0]._avg.shielding,
          avgFishing: auctionStats[0]._avg.fishing,
          avgSoldPrice: auctionStats[0]._avg.soldPrice,
        };
      }
    }

    // 5. Calculate KPIs
    const kpis = calculateKPIs(snapshots);

    // 6. Derive milestones
    const milestones = deriveMilestones(snapshots);

    // Serialize BigInt values
    const response = {
      success: true,
      data: {
        character: serializeBigInt(character),
        snapshots: serializeBigInt(snapshots),
        highscores: serializeBigInt(highscores),
        vocationAverages: serializeBigInt(vocationAverages),
        kpis: serializeBigInt(kpis),
        milestones: serializeBigInt(milestones),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in progression API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
