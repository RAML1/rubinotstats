import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// Helper to convert BigInt and Prisma Decimal to Number for JSON serialization
function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return Number(obj) as T;
  }

  // Preserve Date objects (they are typeof 'object' but should not be iterated)
  if (obj instanceof Date) {
    return obj as T;
  }

  // Handle Prisma Decimal objects (have s, e, d properties or a toNumber method)
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const o = obj as any;
    if (typeof o.toNumber === 'function') {
      return o.toNumber() as T;
    }
    // Handle serialized Decimal objects from cache: {s: sign, e: exponent, d: digits[]}
    if ('s' in o && 'e' in o && 'd' in o && Array.isArray(o.d)) {
      // Reconstruct from Decimal.js format: d[] is base 1e7, first element unpadded
      const parts = o.d as number[];
      const digitStr = parts[0].toString() + parts.slice(1).map((n: number) => String(n).padStart(7, '0')).join('');
      const num = Number(digitStr) * Math.pow(10, o.e - digitStr.length + 1) * o.s;
      return num as T;
    }
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

// Helper to calculate date ranges for month comparisons.
// Uses the latest snapshot date as reference so "this month" aligns with the
// most recent data, not the server clock (avoids UTC midnight rollover issues
// where Feb 28 data appears as "last month" when the server is already March 1 UTC).
function getMonthRanges(referenceDate?: Date) {
  const ref = referenceDate ?? new Date();
  const currentMonthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0));

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
  const latestDate = new Date(latestSnapshot.capturedDate);
  const { currentMonthStart, lastMonthStart, lastMonthEnd } = getMonthRanges(latestDate);

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
    // Uses materialized view (world_leaders_mv) for instant response (~0.05ms vs ~5000ms)
    // View is refreshed by the scraper after daily data ingestion
    const mode = searchParams.get('mode');
    if (mode === 'worldLeaders') {
      const leaders: any[] = await prisma.$queryRaw`
        SELECT world, character_name, vocation, current_level, start_level, exp_gained, levels_gained
        FROM world_leaders_mv
        ORDER BY exp_gained DESC
      `;

      return NextResponse.json({
        success: true,
        data: serializeBigInt(leaders),
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

      // Also search highscore entries for characters not in the characters table.
      // Use the LATEST entry per character to get the current vocation
      // (names can be reused by different characters over time).
      if (results.length < 10) {
        const characterNames = new Set(results.map(r => r.name.toLowerCase()));
        const highscoreChars: { characterName: string; world: string; vocation: string }[] = await prisma.$queryRaw`
          SELECT "characterName", world, vocation FROM (
            SELECT DISTINCT ON (character_name, world)
              character_name AS "characterName", world, vocation
            FROM highscore_entries
            WHERE character_name ILIKE ${'%' + searchQuery + '%'}
            ORDER BY character_name, world, captured_date DESC
          ) sub
          ORDER BY
            CASE WHEN LOWER("characterName") = LOWER(${searchQuery}) THEN 0 ELSE 1 END,
            LENGTH("characterName"),
            "characterName"
          LIMIT 10
        `;

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

    // Normalize vocation to base type for name-reuse detection
    const baseVocation = (voc: string): string => {
      const v = voc.toLowerCase();
      if (v.includes('knight')) return 'knight';
      if (v.includes('paladin')) return 'paladin';
      if (v.includes('sorcerer')) return 'sorcerer';
      if (v.includes('druid')) return 'druid';
      if (v.includes('monk')) return 'monk';
      return v;
    };

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
          charmPoints: null,
          bountyPoints: null,
          bountyRank: null,
          expRank: null,
          mlRank: null,
          fistRank: null,
          clubRank: null,
          swordRank: null,
          axeRank: null,
          distanceRank: null,
          shieldingRank: null,
          fishingRank: null,
          charmRank: null,
          expGained: 0,
          levelsGained: 0,
          vocation: entry.vocation,
        });
      }

      const snapshot = dateMap.get(dateKey)!;
      if (entry.level && entry.level > (snapshot.level || 0)) {
        snapshot.level = entry.level;
      }
      // Update vocation to the latest entry for this date
      if (entry.vocation) {
        snapshot.vocation = entry.vocation;
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
        snapshot.fistRank = entry.rank;
      } else if (cat === 'Club Fighting') {
        snapshot.club = score;
        snapshot.clubRank = entry.rank;
      } else if (cat === 'Sword Fighting') {
        snapshot.sword = score;
        snapshot.swordRank = entry.rank;
      } else if (cat === 'Axe Fighting') {
        snapshot.axe = score;
        snapshot.axeRank = entry.rank;
      } else if (cat === 'Distance Fighting') {
        snapshot.distance = score;
        snapshot.distanceRank = entry.rank;
      } else if (cat === 'Shielding') {
        snapshot.shielding = score;
        snapshot.shieldingRank = entry.rank;
      } else if (cat === 'Fishing') {
        snapshot.fishing = score;
        snapshot.fishingRank = entry.rank;
      } else if (cat === 'Charm Points') {
        snapshot.charmPoints = score;
        snapshot.charmRank = entry.rank;
      } else if (cat === 'Bounty Points') {
        snapshot.bountyPoints = score;
        snapshot.bountyRank = entry.rank;
      }
    }

    // Build sorted snapshots array and calculate daily gains
    let snapshots: any[] = Array.from(dateMap.values()).sort(
      (a: any, b: any) => new Date(a.capturedDate).getTime() - new Date(b.capturedDate).getTime()
    );

    // Detect character name reuse: a different player has taken this name.
    // Indicators:
    //   (1) EXP drops >30%
    //   (2) Vocation change + EXP change >15% in either direction
    //   (3) Level jump >50 for chars above level 500 (max legit daily gain is ~31)
    // Note: vocation change ALONE is NOT name reuse — RubinOT allows
    // legitimate vocation changes (e.g., Paladin → Druid with rising EXP).
    // Discard everything before the last such breakpoint.
    let lastBreakpoint = 0;
    let prevExpVal: number | null = null;
    let prevLevel: number | null = null;
    let prevBaseVoc: string | null = null;
    for (let i = 0; i < snapshots.length; i++) {
      const curBaseVoc = snapshots[i].vocation ? baseVocation(snapshots[i].vocation) : null;
      const curLevel = snapshots[i].level || null;

      // Vocation change + any significant EXP change = name reuse.
      // Legitimate vocation changes keep EXP nearly identical (±10%).
      if (curBaseVoc && prevBaseVoc && curBaseVoc !== prevBaseVoc) {
        if (snapshots[i].experience != null && prevExpVal !== null) {
          const ratio = snapshots[i].experience / prevExpVal;
          if (ratio < 0.9 || ratio > 1.15) {
            lastBreakpoint = i;
          }
        }
      }

      if (snapshots[i].experience != null) {
        if (prevExpVal !== null) {
          // Significant EXP drop (>30%) = likely name reuse
          if (snapshots[i].experience < prevExpVal * 0.7) {
            lastBreakpoint = i;
          }
        }
        prevExpVal = snapshots[i].experience;
      }

      // Level jump >50 at high levels = name reuse.
      // Max legit daily gain is ~31 levels even for the most active players.
      // Use 50 as threshold for safety margin.
      if (curLevel && prevLevel && prevLevel >= 500) {
        if (curLevel - prevLevel > 50) {
          lastBreakpoint = i;
        }
      }
      if (curLevel) prevLevel = curLevel;

      if (curBaseVoc) prevBaseVoc = curBaseVoc;
    }
    if (lastBreakpoint > 0) {
      snapshots = snapshots.slice(lastBreakpoint);
    }

    // If no snapshot has Experience Points data, estimate EXP from levels
    // using the standard Tibia formula: EXP(lvl) = (50/3) * (lvl^3 - 6*lvl^2 + 17*lvl - 12)
    const hasExpData = snapshots.some(s => s.experience != null);
    if (!hasExpData) {
      const levelToExp = (lvl: number) =>
        Math.round((50 / 3) * (lvl * lvl * lvl - 6 * lvl * lvl + 17 * lvl - 12));
      for (const s of snapshots) {
        if (s.level > 0) {
          s.experience = levelToExp(s.level);
          s.estimatedExp = true;
        }
      }
    }

    // Calculate daily gains — look back to last snapshot with valid data
    // (handles gaps where a category wasn't scraped for some days)
    // Clamp negative expGained to 0 (PvP death penalties shouldn't distort charts)
    let lastExpIdx = snapshots[0]?.experience != null ? 0 : -1;
    let lastLevelIdx = snapshots[0]?.level != null ? 0 : -1;

    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].experience != null && lastExpIdx >= 0) {
        const diff = snapshots[i].experience - snapshots[lastExpIdx].experience;
        snapshots[i].expGained = Math.max(0, diff);
      }
      if (snapshots[i].experience != null) lastExpIdx = i;

      if (snapshots[i].level != null && lastLevelIdx >= 0) {
        const diff = snapshots[i].level - snapshots[lastLevelIdx].level;
        snapshots[i].levelsGained = Math.max(0, diff);
      }
      if (snapshots[i].level != null) lastLevelIdx = i;
    }

    // 4. Get vocation averages by level range across all worlds
    // Use progressively wider ranges to ensure we find comparison data
    let vocationAverages = null;
    if (char.vocation) {
      let charLevel = 0;
      if (snapshots.length > 0) {
        charLevel = (snapshots[snapshots.length - 1] as any).level || 0;
      } else if (highscores.length > 0) {
        charLevel = Math.max(...highscores.map((h: any) => h.level || 0));
      }

      // Try progressively wider ranges: ±100, ±250, ±500, then top 200 auctions
      const ranges = [100, 250, 500];
      let usedRange = '';

      for (const range of ranges) {
        const levelMin = Math.max(1, charLevel - range);
        const levelMax = charLevel + range;

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
          usedRange = `${levelMin}-${levelMax}`;
          vocationAverages = {
            vocation: char.vocation,
            levelRange: usedRange,
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
          break;
        }
      }

      // Final fallback: use top 200 highest-level auctions for this vocation
      if (!vocationAverages) {
        const topAuctions = await prisma.auction.findMany({
          where: { vocation: char.vocation },
          orderBy: { level: 'desc' },
          take: 200,
          select: {
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

        if (topAuctions.length > 0) {
          const count = topAuctions.length;
          const sum = (key: keyof typeof topAuctions[0]) =>
            topAuctions.reduce((acc, a) => acc + ((a[key] as number) || 0), 0);

          const minLevel = topAuctions[topAuctions.length - 1].level || 0;
          const maxLevel = topAuctions[0].level || 0;

          vocationAverages = {
            vocation: char.vocation,
            levelRange: `${minLevel}-${maxLevel}`,
            avgLevel: sum('level') / count,
            avgMagicLevel: sum('magicLevel') / count,
            avgFist: sum('fist') / count,
            avgClub: sum('club') / count,
            avgSword: sum('sword') / count,
            avgAxe: sum('axe') / count,
            avgDistance: sum('distance') / count,
            avgShielding: sum('shielding') / count,
            avgFishing: sum('fishing') / count,
          };
        }
      }
    }

    // 5. Calculate KPIs from snapshots
    const kpis = calculateKPIs(snapshots);

    // 6. Derive milestones
    const milestones = deriveMilestones(snapshots);

    // 7. Build skill ranks by walking backwards through snapshots to find latest non-null rank for each skill
    const rankKeys = [
      ['experience', 'expRank'],
      ['magicLevel', 'mlRank'],
      ['fist', 'fistRank'],
      ['club', 'clubRank'],
      ['sword', 'swordRank'],
      ['axe', 'axeRank'],
      ['distance', 'distanceRank'],
      ['shielding', 'shieldingRank'],
      ['fishing', 'fishingRank'],
      ['charmPoints', 'charmRank'],
      ['bountyPoints', 'bountyRank'],
    ] as const;

    let skillRanks: Record<string, number | null> | null = null;
    if (snapshots.length > 0) {
      skillRanks = {};
      for (const [outputKey, snapshotKey] of rankKeys) {
        for (let i = snapshots.length - 1; i >= 0; i--) {
          const val = (snapshots[i] as any)[snapshotKey];
          if (val != null) {
            skillRanks[outputKey] = val;
            break;
          }
        }
        if (!(outputKey in skillRanks)) {
          skillRanks[outputKey] = null;
        }
      }
      // If all ranks are null, set to null
      if (Object.values(skillRanks).every((v) => v === null)) {
        skillRanks = null;
      }
    }

    // Update character vocation from latest snapshot (in case of name reuse,
    // the character table may have stale vocation from the old character)
    if (snapshots.length > 0) {
      const latestVoc = snapshots[snapshots.length - 1].vocation;
      if (latestVoc) {
        (char as any).vocation = latestVoc;
      }
    }

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
        skillRanks: serializeBigInt(skillRanks),
        estimatedExp: !hasExpData,
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
