'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

// --- Vocation grouping: base + promoted → single group ---
const VOCATION_GROUP: Record<string, string> = {
  'Knight': 'Knight',
  'Elite Knight': 'Knight',
  'Paladin': 'Paladin',
  'Royal Paladin': 'Paladin',
  'Sorcerer': 'Sorcerer',
  'Master Sorcerer': 'Sorcerer',
  'Druid': 'Druid',
  'Elder Druid': 'Druid',
  'Monk': 'Monk',
  'Exalted Monk': 'Monk',
};

function getBaseVocation(vocation: string): string {
  return VOCATION_GROUP[vocation] || vocation;
}

// All primary combat skills
const ALL_SKILLS: { key: string; label: string }[] = [
  { key: 'magicLevel', label: 'Magic Level' },
  { key: 'fist', label: 'Fist' },
  { key: 'club', label: 'Club' },
  { key: 'sword', label: 'Sword' },
  { key: 'axe', label: 'Axe' },
  { key: 'distance', label: 'Distance' },
  { key: 'shielding', label: 'Shielding' },
];

// Which skills are "primary" for each vocation (highlighted)
function getVocationPrimarySkills(vocation: string): Set<string> {
  const voc = vocation.toLowerCase();
  if (voc.includes('knight')) return new Set(['shielding', 'sword', 'axe', 'club', 'magicLevel']);
  if (voc.includes('paladin')) return new Set(['distance', 'shielding', 'magicLevel']);
  if (voc.includes('sorcerer')) return new Set(['magicLevel']);
  if (voc.includes('druid')) return new Set(['magicLevel']);
  if (voc.includes('monk')) return new Set(['fist', 'magicLevel']);
  return new Set(['magicLevel']);
}

interface VocationStat {
  vocation: string | null;
  _count: { id: number };
  _avg: { soldPrice: number | null; coinsPerLevel: number | null };
  _min: { soldPrice: number | null };
  _max: { soldPrice: number | null };
}

interface AvgSkillStat {
  vocation: string | null;
  _avg: {
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    level: number | null;
  };
}

interface MarketData {
  vocationStats: VocationStat[];
  recentHighPrice: { characterName: string; soldPrice: number; level: number; vocation: string; world: string } | null;
  recentLowPrice: { characterName: string; soldPrice: number; level: number; vocation: string; world: string } | null;
  totalAuctions: number;
  worlds: string[];
  avgSkills: AvgSkillStat[];
}

interface GroupedVocStat {
  baseVocation: string;
  count: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgCoinsPerLevel: number;
}

interface GroupedSkillStat {
  baseVocation: string;
  avgLevel: number;
  skills: Record<string, number | null>;
  sampleCount: number;
}

function groupVocationStats(stats: VocationStat[]): GroupedVocStat[] {
  const groups: Record<string, { count: number; totalPrice: number; minPrice: number; maxPrice: number; totalCpl: number; cplCount: number }> = {};

  for (const stat of stats) {
    if (!stat.vocation) continue;
    const base = getBaseVocation(stat.vocation);
    if (!groups[base]) {
      groups[base] = { count: 0, totalPrice: 0, minPrice: Infinity, maxPrice: 0, totalCpl: 0, cplCount: 0 };
    }
    const g = groups[base];
    g.count += stat._count.id;
    g.totalPrice += (stat._avg.soldPrice || 0) * stat._count.id;
    g.minPrice = Math.min(g.minPrice, stat._min.soldPrice || Infinity);
    g.maxPrice = Math.max(g.maxPrice, stat._max.soldPrice || 0);
    if (stat._avg.coinsPerLevel) {
      g.totalCpl += stat._avg.coinsPerLevel * stat._count.id;
      g.cplCount += stat._count.id;
    }
  }

  return Object.entries(groups)
    .map(([base, g]) => ({
      baseVocation: base,
      count: g.count,
      avgPrice: g.count > 0 ? g.totalPrice / g.count : 0,
      minPrice: g.minPrice === Infinity ? 0 : g.minPrice,
      maxPrice: g.maxPrice,
      avgCoinsPerLevel: g.cplCount > 0 ? g.totalCpl / g.cplCount : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function groupAvgSkills(stats: AvgSkillStat[]): GroupedSkillStat[] {
  const skillKeys = ['magicLevel', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding'] as const;
  const groups: Record<string, { totalLevel: number; skills: Record<string, { total: number; count: number }>; count: number }> = {};

  for (const stat of stats) {
    if (!stat.vocation) continue;
    const base = getBaseVocation(stat.vocation);
    if (!groups[base]) {
      groups[base] = {
        totalLevel: 0,
        skills: Object.fromEntries(skillKeys.map((k) => [k, { total: 0, count: 0 }])),
        count: 0,
      };
    }
    const g = groups[base];
    g.count += 1;
    if (stat._avg.level) g.totalLevel += stat._avg.level;
    for (const key of skillKeys) {
      const val = stat._avg[key];
      if (val !== null) {
        g.skills[key].total += val;
        g.skills[key].count += 1;
      }
    }
  }

  return Object.entries(groups)
    .map(([base, g]) => ({
      baseVocation: base,
      avgLevel: g.count > 0 ? Math.round(g.totalLevel / g.count) : 0,
      skills: Object.fromEntries(
        skillKeys.map((k) => [k, g.skills[k].count > 0 ? g.skills[k].total / g.skills[k].count : null])
      ),
      sampleCount: g.count,
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount);
}

export default function MarketClient() {
  const [selectedWorld, setSelectedWorld] = useState('all');
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = selectedWorld !== 'all' ? `?world=${encodeURIComponent(selectedWorld)}` : '';
        const res = await fetch(`/api/market${params}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setData(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch market data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedWorld]);

  const grouped = useMemo(() => {
    if (!data) return null;
    return {
      vocStats: groupVocationStats(data.vocationStats),
      skillStats: groupAvgSkills(data.avgSkills),
    };
  }, [data]);

  if (loading || !data || !grouped) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const { recentHighPrice, recentLowPrice, totalAuctions, worlds } = data;
  const totalSold = grouped.vocStats.reduce((acc, v) => acc + v.count, 0);
  const overallAvg = totalSold > 0
    ? grouped.vocStats.reduce((acc, v) => acc + v.avgPrice * v.count, 0) / totalSold
    : 0;

  return (
    <div className="space-y-8">
      {/* World Filter */}
      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <select
          value={selectedWorld}
          onChange={(e) => setSelectedWorld(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All Worlds</option>
          {worlds.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        {selectedWorld !== 'all' && (
          <button
            onClick={() => setSelectedWorld('all')}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Overview Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sold</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalAuctions)}</div>
            <p className="text-xs text-muted-foreground">Characters sold on auction</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Price</CardTitle>
            <Minus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(Math.round(overallAvg))} TC</div>
            <p className="text-xs text-muted-foreground">Across all vocations</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Highest Sale</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {formatNumber(recentHighPrice?.soldPrice || 0)} TC
            </div>
            <p className="text-xs text-muted-foreground">
              {recentHighPrice?.characterName} — Lvl {recentHighPrice?.level} {recentHighPrice?.vocation}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lowest Sale</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {formatNumber(recentLowPrice?.soldPrice || 0)} TC
            </div>
            <p className="text-xs text-muted-foreground">
              {recentLowPrice?.characterName} — Lvl {recentLowPrice?.level} {recentLowPrice?.vocation}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Vocation Breakdown (grouped) */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Price by Vocation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.vocStats.map((stat) => {
            const vocColor = getVocationColor(stat.baseVocation);
            const percentage = totalSold > 0 ? ((stat.count / totalSold) * 100).toFixed(1) : '0';
            return (
              <Card key={stat.baseVocation} className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: vocColor }} />
                      <p className="font-semibold">{stat.baseVocation}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{stat.count} sold ({percentage}%)</span>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Avg: {formatNumber(Math.round(stat.avgPrice))} TC</span>
                      <span>{stat.avgCoinsPerLevel ? `${stat.avgCoinsPerLevel.toFixed(1)} TC/lvl` : ''}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (stat.avgPrice / (overallAvg || 1)) * 50)}%`,
                          backgroundColor: vocColor,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Min: {formatNumber(stat.minPrice)} TC</span>
                      <span>Max: {formatNumber(stat.maxPrice)} TC</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Average Skills by Vocation (grouped, all skills shown) */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Average Skills by Vocation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.skillStats.map((stat) => {
            const vocColor = getVocationColor(stat.baseVocation);
            const primarySkills = getVocationPrimarySkills(stat.baseVocation);

            return (
              <Card key={stat.baseVocation} className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: vocColor }} />
                    <p className="font-semibold">{stat.baseVocation}</p>
                    {stat.avgLevel > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Avg Lvl {stat.avgLevel}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {ALL_SKILLS.map(({ key, label }) => {
                      const val = stat.skills[key];
                      const isPrimary = primarySkills.has(key);
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between text-sm rounded px-2 py-0.5 ${
                            isPrimary
                              ? 'border-l-2 bg-primary/10 pl-2'
                              : 'opacity-50'
                          }`}
                          style={isPrimary ? { borderLeftColor: vocColor } : undefined}
                        >
                          <span className={isPrimary ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                            {label}
                          </span>
                          <span
                            className={isPrimary ? 'font-bold' : 'text-muted-foreground'}
                            style={isPrimary ? { color: vocColor } : undefined}
                          >
                            {val !== null ? Math.round(val) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
