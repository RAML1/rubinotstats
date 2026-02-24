import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import prisma from '@/lib/db/prisma';

// Helper to convert BigInt to Number for JSON serialization
function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return Number(obj) as T;
  }

  // Preserve Date objects (they are typeof 'object' but should not be iterated)
  if (obj instanceof Date) {
    return obj as T;
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

// Human-readable skill labels
const SKILL_LABELS: Record<string, string> = {
  magicLevel: 'Magic Level',
  fist: 'Fist Fighting',
  club: 'Club Fighting',
  sword: 'Sword Fighting',
  axe: 'Axe Fighting',
  distance: 'Distance Fighting',
  shielding: 'Shielding',
  fishing: 'Fishing',
};

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
              const skillLabel = SKILL_LABELS[skill] || skill;
              milestones.push({
                type: 'skill',
                skill: skillLabel,
                value: milestoneValue,
                date: snapshot.capturedDate,
                description: `${skillLabel} reached ${milestoneValue}`,
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

    // World leaders mode: top EXP gainer per world in last 30 days
    const mode = searchParams.get('mode');
    if (mode === 'worldLeaders') {
      const getWorldLeaders = unstable_cache(
        async () => {
          const leaders: any[] = await prisma.$queryRaw`
            WITH daily AS (
              SELECT
                character_name, world, captured_date, level, score, vocation,
                LAG(level) OVER (PARTITION BY character_name, world ORDER BY captured_date) AS prev_level,
                LAG(score) OVER (PARTITION BY character_name, world ORDER BY captured_date) AS prev_score
              FROM highscore_entries
              WHERE category = 'Experience Points'
                AND captured_date >= CURRENT_DATE - INTERVAL '30 days'
                AND level IS NOT NULL
            ),
            gains AS (
              SELECT
                character_name, world, vocation, level, score, captured_date,
                CASE
                  WHEN prev_level IS NOT NULL AND level - prev_level > 0
                    AND (prev_score IS NOT NULL AND score - prev_score > 0)
                    AND level - prev_level <= GREATEST(50, prev_level * 0.15)
                  THEN level - prev_level
                  ELSE 0
                END AS safe_level_gain,
                CASE
                  WHEN prev_score IS NOT NULL AND score > prev_score
                  THEN score - prev_score
                  ELSE 0
                END AS daily_exp_gain
              FROM daily
            ),
            aggregated AS (
              SELECT
                character_name, world,
                (array_agg(vocation ORDER BY captured_date DESC))[1] AS vocation,
                (array_agg(level ORDER BY captured_date DESC))[1] AS current_level,
                (array_agg(level ORDER BY captured_date ASC))[1] AS start_level,
                SUM(daily_exp_gain) AS exp_gained,
                SUM(safe_level_gain) AS levels_gained
              FROM gains
              GROUP BY character_name, world
              HAVING SUM(daily_exp_gain) > 0
            )
            SELECT DISTINCT ON (world)
              world, character_name, vocation, current_level, start_level, exp_gained, levels_gained
            FROM aggregated
            ORDER BY world, exp_gained DESC
          `;
          return serializeBigInt(leaders);
        },
        ['world-leaders'],
        { revalidate: 600 } // Cache for 10 minutes
      );

      const leaders = await getWorldLeaders();
      // Sort by exp_gained descending (DISTINCT ON returns sorted by world)
      leaders.sort((a: any, b: any) => Number(b.exp_gained) - Number(a.exp_gained));

      return NextResponse.json({
        success: true,
        data: leaders,
      });
    }

    // Search mode: return character name matches
    if (!characterName && searchQuery) {
      // Search characters table first
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

      const results = characters.map(c => ({
        name: c.name,
        world: c.world.name,
        vocation: c.vocation,
      }));

      // Also search highscore entries for characters not in the characters table
      if (results.length < 10) {
        const characterNames = new Set(results.map(r => r.name.toLowerCase()));
        const highscoreChars = await prisma.highscoreEntry.findMany({
          where: {
            characterName: {
              contains: searchQuery,
              mode: 'insensitive',
            },
          },
          distinct: ['characterName', 'world'],
          select: {
            characterName: true,
            world: true,
            vocation: true,
          },
          take: 10,
        });

        for (const h of highscoreChars) {
          if (!characterNames.has(h.characterName.toLowerCase()) && results.length < 10) {
            characterNames.add(h.characterName.toLowerCase());
            results.push({
              name: h.characterName,
              world: h.world,
              vocation: h.vocation,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
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
    let character = await prisma.character.findFirst({
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

    // Fall back to highscore entries if character not in characters table
    if (!character) {
      const hsEntry = await prisma.highscoreEntry.findFirst({
        where: {
          characterName: {
            equals: characterName,
            mode: 'insensitive',
          },
        },
      });

      if (!hsEntry) {
        return NextResponse.json(
          { success: false, error: 'Character not found' },
          { status: 404 }
        );
      }

      // Build a synthetic character object from highscore data
      character = {
        id: 0,
        name: hsEntry.characterName,
        worldId: 0,
        vocation: hsEntry.vocation,
        guildName: null,
        firstSeen: hsEntry.createdAt,
        lastUpdated: hsEntry.createdAt,
        world: { id: 0, name: hsEntry.world, pvpType: null, isActive: true, createdAt: hsEntry.createdAt },
      } as any;
    }

    // At this point character is guaranteed non-null (either from DB or synthetic)
    const char = character!;

    // 2. Get highscore entries (primary data source for progression)
    const highscores = await prisma.highscoreEntry.findMany({
      where: {
        characterName: {
          equals: char.name,
          mode: 'insensitive',
        },
        world: char.world.name,
      },
      orderBy: {
        capturedDate: 'asc',
      },
    });

    // 3. Build snapshots from highscore entries grouped by date
    const toNum = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'bigint') return Number(val);
      return Number(val);
    };

    const toDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dateMap = new Map<string, any>();

    for (const entry of highscores) {
      const dateKey = toDateKey(new Date(entry.capturedDate));

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          id: 0,
          characterId: char.id,
          capturedDate: entry.capturedDate,
          level: entry.level || 0,
          experience: null,
          magicLevel: null,
          fist: null,
          club: null,
          sword: null,
          axe: null,
          distance: null,
          shielding: null,
          fishing: null,
          expRank: null,
          mlRank: null,
          expGained: 0,
          levelsGained: 0,
        });
      }

      const snapshot = dateMap.get(dateKey)!;
      if (entry.level && entry.level > (snapshot.level || 0)) {
        snapshot.level = entry.level;
      }

      const cat = entry.category;
      const score = toNum(entry.score);

      if (cat === 'Experience Points') {
        snapshot.experience = score;
        snapshot.expRank = entry.rank;
      } else if (cat === 'Magic Level') {
        snapshot.magicLevel = score;
        snapshot.mlRank = entry.rank;
      } else if (cat === 'Fist Fighting') {
        snapshot.fist = score;
      } else if (cat === 'Club Fighting') {
        snapshot.club = score;
      } else if (cat === 'Sword Fighting') {
        snapshot.sword = score;
      } else if (cat === 'Axe Fighting') {
        snapshot.axe = score;
      } else if (cat === 'Distance Fighting') {
        snapshot.distance = score;
      } else if (cat === 'Shielding') {
        snapshot.shielding = score;
      } else if (cat === 'Fishing') {
        snapshot.fishing = score;
      }
    }

    // Build sorted snapshots array and calculate daily gains
    let snapshots: any[] = Array.from(dateMap.values()).sort(
      (a: any, b: any) => new Date(a.capturedDate).getTime() - new Date(b.capturedDate).getTime()
    );

    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].experience != null && snapshots[i - 1].experience != null) {
        snapshots[i].expGained = snapshots[i].experience - snapshots[i - 1].experience;
      }
      if (snapshots[i].level != null && snapshots[i - 1].level != null) {
        snapshots[i].levelsGained = snapshots[i].level - snapshots[i - 1].level;
      }
    }

    // 4. Get vocation averages by level range (+/- 10 levels) across all worlds
    let vocationAverages = null;
    if (char.vocation) {
      // Determine character level from latest snapshot or highscores
      let charLevel = 0;
      if (snapshots.length > 0) {
        charLevel = (snapshots[snapshots.length - 1] as any).level || 0;
      } else if (highscores.length > 0) {
        charLevel = Math.max(...highscores.map((h: any) => h.level || 0));
      }

      const levelMin = Math.max(1, charLevel - 100);
      const levelMax = charLevel + 100;

      const auctionStats = await prisma.auction.groupBy({
        by: ['vocation'],
        where: {
          vocation: char.vocation,
          level: { gte: levelMin, lte: levelMax },
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
        },
      });

      if (auctionStats.length > 0) {
        vocationAverages = {
          vocation: char.vocation,
          levelRange: `${levelMin}-${levelMax}`,
          avgLevel: auctionStats[0]._avg.level,
          avgMagicLevel: auctionStats[0]._avg.magicLevel,
          avgFist: auctionStats[0]._avg.fist,
          avgClub: auctionStats[0]._avg.club,
          avgSword: auctionStats[0]._avg.sword,
          avgAxe: auctionStats[0]._avg.axe,
          avgDistance: auctionStats[0]._avg.distance,
          avgShielding: auctionStats[0]._avg.shielding,
          avgFishing: auctionStats[0]._avg.fishing,
        };
      }
    }

    // 5. Calculate KPIs from snapshots
    const kpis = calculateKPIs(snapshots);

    // 6. Derive milestones
    const milestones = deriveMilestones(snapshots);

    // Serialize BigInt values
    const response = {
      success: true,
      data: {
        character: serializeBigInt(char),
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
