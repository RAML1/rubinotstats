'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useMemo } from 'react';

interface VocationComparisonProps {
  characterName: string;
  vocation: string;
  currentStats: {
    level: number | null;
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    fishing: number | null;
  } | null;
  vocationAverages: {
    levelRange?: string;
    avgLevel: number | null;
    avgMagicLevel: number | null;
    avgFist: number | null;
    avgClub: number | null;
    avgSword: number | null;
    avgAxe: number | null;
    avgDistance: number | null;
    avgShielding: number | null;
    avgFishing: number | null;
  } | null;
}

function getVocationColor(vocation: string): string {
  const vocLower = vocation.toLowerCase();
  if (vocLower.includes('monk')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (vocLower.includes('knight')) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (vocLower.includes('paladin')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (vocLower.includes('sorcerer')) return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
  if (vocLower.includes('druid')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

function getVocationBarColor(vocation: string): string {
  const vocLower = vocation.toLowerCase();
  if (vocLower.includes('monk')) return 'bg-orange-500';
  if (vocLower.includes('knight')) return 'bg-red-500';
  if (vocLower.includes('paladin')) return 'bg-amber-500';
  if (vocLower.includes('sorcerer')) return 'bg-violet-500';
  if (vocLower.includes('druid')) return 'bg-emerald-500';
  return 'bg-gray-500';
}

function getRelevantStats(vocation: string): string[] {
  const vocLower = vocation.toLowerCase();
  if (vocLower.includes('monk')) return ['fist', 'magicLevel'];
  if (vocLower.includes('knight')) return ['shielding', 'sword', 'axe', 'club', 'magicLevel'];
  if (vocLower.includes('paladin')) return ['distance', 'magicLevel'];
  if (vocLower.includes('druid')) return ['magicLevel'];
  if (vocLower.includes('sorcerer')) return ['magicLevel'];
  return ['magicLevel', 'shielding'];
}

function StatLabel(stat: string): string {
  const labels: Record<string, string> = {
    level: 'Level',
    magicLevel: 'Magic Level',
    fist: 'Fist',
    club: 'Club',
    sword: 'Sword',
    axe: 'Axe',
    distance: 'Distance',
    shielding: 'Shielding',
  };
  return labels[stat] || stat;
}

interface StatComparison {
  stat: string;
  characterValue: number;
  averageValue: number;
}

export function VocationComparison({
  characterName,
  vocation,
  currentStats,
  vocationAverages,
}: VocationComparisonProps) {
  const { comparisons, aboveAverage, belowAverage } = useMemo(() => {
    if (!currentStats || !vocationAverages) {
      return { comparisons: [], aboveAverage: 0, belowAverage: 0 };
    }

    const relevantStats = getRelevantStats(vocation);
    const comps: StatComparison[] = [];
    let above = 0;
    let below = 0;

    relevantStats.forEach((stat) => {
      const characterValue =
        currentStats[stat as keyof typeof currentStats];
      const averageValue =
        vocationAverages[
          `avg${stat.charAt(0).toUpperCase()}${stat.slice(1)}` as keyof typeof vocationAverages
        ];

      if (characterValue !== null && averageValue !== null && typeof averageValue === 'number') {
        comps.push({
          stat,
          characterValue: characterValue as number,
          averageValue,
        });

        if ((characterValue as number) > averageValue) {
          above++;
        } else if ((characterValue as number) < averageValue) {
          below++;
        }
      }
    });

    return { comparisons: comps, aboveAverage: above, belowAverage: below };
  }, [currentStats, vocationAverages, vocation]);

  const hasData = comparisons.length > 0;
  const vocBarColor = getVocationBarColor(vocation);
  const vocBadgeColor = getVocationColor(vocation);
  const levelRange = vocationAverages?.levelRange;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <div className="flex items-center gap-2 mb-6 p-6 pb-0">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Vocation Comparison</h2>
      </div>

      <div className="p-6 space-y-6">
        {!hasData ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Search for a character to compare</p>
          </div>
        ) : (
          <>
            {/* Vocation Badge + Level Range */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${vocBadgeColor} border`}>{vocation}</Badge>
              {levelRange && (
                <span className="text-xs text-muted-foreground">
                  vs avg of levels {levelRange}
                </span>
              )}
            </div>

            {/* Stats Comparison */}
            <div className="space-y-4">
              {comparisons.map(({ stat, characterValue, averageValue }) => {
                const max = Math.max(characterValue, averageValue);
                const characterPercent = (characterValue / max) * 100;
                const averagePercent = (averageValue / max) * 100;

                return (
                  <div key={stat} className="space-y-2">
                    <div className="text-sm font-medium text-foreground">
                      {StatLabel(stat)}
                    </div>

                    {/* Character Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 bg-background/50 rounded overflow-hidden">
                        <div
                          className={`${vocBarColor} h-full flex items-center justify-end pr-2 transition-all duration-300`}
                          style={{ width: `${characterPercent}%` }}
                        >
                          <span className="text-xs font-semibold text-white whitespace-nowrap">
                            {characterValue}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Average Bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-5 bg-background/50 rounded overflow-hidden">
                        <div
                          className="bg-muted-foreground/40 h-full flex items-center justify-end pr-2 transition-all duration-300"
                          style={{ width: `${averagePercent}%` }}
                        >
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Avg: {Math.round(averageValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {(aboveAverage > 0 || belowAverage > 0) && (
              <div className="border-t border-border/30 pt-4">
                <p className="text-sm text-muted-foreground">
                  Above average in{' '}
                  <span className="text-foreground font-medium">{aboveAverage} stat{aboveAverage !== 1 ? 's' : ''}</span>
                  {belowAverage > 0 && (
                    <>
                      , below in{' '}
                      <span className="text-foreground font-medium">
                        {belowAverage} stat{belowAverage !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
