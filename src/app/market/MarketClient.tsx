'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

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

function getRelevantSkills(vocation: string): { key: string; label: string }[] {
  const voc = vocation.toLowerCase();
  if (voc.includes('knight') || voc.includes('ek')) {
    return [
      { key: 'shielding', label: 'Shield' },
      { key: 'sword', label: 'Sword' },
      { key: 'axe', label: 'Axe' },
      { key: 'club', label: 'Club' },
      { key: 'magicLevel', label: 'ML' },
    ];
  }
  if (voc.includes('paladin') || voc.includes('rp')) {
    return [
      { key: 'distance', label: 'Dist' },
      { key: 'shielding', label: 'Shield' },
      { key: 'magicLevel', label: 'ML' },
    ];
  }
  if (voc.includes('sorcerer') || voc.includes('ms') || voc.includes('druid') || voc.includes('ed')) {
    return [
      { key: 'magicLevel', label: 'ML' },
    ];
  }
  if (voc.includes('monk')) {
    return [
      { key: 'fist', label: 'Fist' },
      { key: 'magicLevel', label: 'ML' },
    ];
  }
  return [
    { key: 'magicLevel', label: 'ML' },
    { key: 'distance', label: 'Dist' },
    { key: 'shielding', label: 'Shield' },
  ];
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const { vocationStats, recentHighPrice, recentLowPrice, totalAuctions, worlds, avgSkills } = data;
  const totalSold = vocationStats.reduce((acc, v) => acc + v._count.id, 0);
  const overallAvg = vocationStats.reduce((acc, v) => acc + (v._avg.soldPrice || 0) * v._count.id, 0) / (totalSold || 1);

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

      {/* Vocation Breakdown */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Price by Vocation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vocationStats.map((stat) => {
            const vocColor = getVocationColor(stat.vocation || '');
            const percentage = totalSold > 0 ? ((stat._count.id / totalSold) * 100).toFixed(1) : '0';
            return (
              <Card key={stat.vocation} className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: vocColor }}
                      />
                      <p className="font-semibold">{stat.vocation}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{stat._count.id} sold ({percentage}%)</span>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Avg: {formatNumber(Math.round(stat._avg.soldPrice || 0))} TC</span>
                      <span>{stat._avg.coinsPerLevel ? `${(stat._avg.coinsPerLevel).toFixed(1)} TC/lvl` : ''}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((stat._avg.soldPrice || 0) / (overallAvg || 1)) * 50)}%`,
                          backgroundColor: vocColor,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Min: {formatNumber(stat._min.soldPrice || 0)} TC</span>
                      <span>Max: {formatNumber(stat._max.soldPrice || 0)} TC</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Average Skills by Vocation */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Average Skills by Vocation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {avgSkills
            .filter((s) => s.vocation)
            .map((stat) => {
              const vocColor = getVocationColor(stat.vocation || '');
              const skills = getRelevantSkills(stat.vocation || '');

              return (
                <Card key={stat.vocation} className="border-border/50 bg-card/50 backdrop-blur">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: vocColor }}
                      />
                      <p className="font-semibold">{stat.vocation}</p>
                      {stat._avg.level && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          Avg Lvl {Math.round(stat._avg.level)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {skills.map(({ key, label }) => {
                        const val = stat._avg[key as keyof typeof stat._avg];
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">
                              {val !== null ? Math.round(val as number) : '—'}
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
