'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Star, Calendar } from 'lucide-react';
import { formatExp, formatNumber, getVocationColor } from '@/lib/utils/formatters';
import { format } from 'date-fns';
import TrainingHeatmap from './TrainingHeatmap';

interface CharacterData {
  character: {
    name: string;
    vocation: string | null;
    world: { name: string };
  };
  snapshots: Array<{
    capturedDate: string;
    level: number | null;
    experience: number | null;
    expGained: number | null;
    levelsGained: number | null;
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    fishing: number | null;
  }>;
  kpis: {
    currentLevel: number;
    expGainedThisMonth: number;
    levelsGainedThisMonth: number;
    bestDayEver: { date: string | null; expGained: number };
    bestWeekEver: { startDate: string | null; endDate: string | null; expGained: number };
    currentExpRank: number | null;
    currentMlRank: number | null;
  };
}

interface CompareViewProps {
  primary: CharacterData;
  compare: CharacterData;
}

function CompareKPI({
  label,
  icon: Icon,
  primaryValue,
  compareValue,
  primaryName,
  compareName,
  format: fmt,
}: {
  label: string;
  icon: React.ElementType;
  primaryValue: number;
  compareValue: number;
  primaryName: string;
  compareName: string;
  format: (v: number) => string;
}) {
  const primaryWins = primaryValue > compareValue;
  const tie = primaryValue === compareValue;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon size={16} className="text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate max-w-[120px]">{primaryName}</span>
          <span className={`text-lg font-bold ${!tie && primaryWins ? 'text-emerald-400' : ''}`}>
            {fmt(primaryValue)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate max-w-[120px] text-muted-foreground">{compareName}</span>
          <span className={`text-lg font-bold ${!tie && !primaryWins ? 'text-emerald-400' : ''}`}>
            {fmt(compareValue)}
          </span>
        </div>
        {/* Visual bar */}
        {(primaryValue > 0 || compareValue > 0) && (
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-secondary">
            <div
              className="bg-primary rounded-l-full"
              style={{ width: `${primaryValue + compareValue > 0 ? (primaryValue / (primaryValue + compareValue)) * 100 : 50}%` }}
            />
            <div
              className="bg-amber-500 rounded-r-full"
              style={{ width: `${primaryValue + compareValue > 0 ? (compareValue / (primaryValue + compareValue)) * 100 : 50}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompareView({ primary, compare }: CompareViewProps) {
  const skillComparison = useMemo(() => {
    const pSnap = primary.snapshots.length > 0 ? primary.snapshots[primary.snapshots.length - 1] : null;
    const cSnap = compare.snapshots.length > 0 ? compare.snapshots[compare.snapshots.length - 1] : null;
    if (!pSnap || !cSnap) return [];

    const skills = [
      { key: 'magicLevel', label: 'Magic Level' },
      { key: 'fist', label: 'Fist' },
      { key: 'club', label: 'Club' },
      { key: 'sword', label: 'Sword' },
      { key: 'axe', label: 'Axe' },
      { key: 'distance', label: 'Distance' },
      { key: 'shielding', label: 'Shielding' },
      { key: 'fishing', label: 'Fishing' },
    ] as const;

    return skills
      .map((s) => ({
        label: s.label,
        primary: (pSnap as any)[s.key] as number | null,
        compare: (cSnap as any)[s.key] as number | null,
      }))
      .filter((s) => s.primary !== null || s.compare !== null);
  }, [primary.snapshots, compare.snapshots]);

  return (
    <div className="space-y-6">
      {/* Character header badges */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="text-sm px-3 py-1" style={{ backgroundColor: getVocationColor(primary.character.vocation || '') }}>
          {primary.character.name}
        </Badge>
        <span className="text-muted-foreground text-sm">vs</span>
        <Badge className="text-sm px-3 py-1 bg-amber-500">
          {compare.character.name}
        </Badge>
      </div>

      {/* KPI Comparison Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompareKPI
          label="Current Level"
          icon={Trophy}
          primaryValue={primary.kpis.currentLevel}
          compareValue={compare.kpis.currentLevel}
          primaryName={primary.character.name}
          compareName={compare.character.name}
          format={(v) => String(v)}
        />
        <CompareKPI
          label="EXP This Month"
          icon={Zap}
          primaryValue={primary.kpis.expGainedThisMonth}
          compareValue={compare.kpis.expGainedThisMonth}
          primaryName={primary.character.name}
          compareName={compare.character.name}
          format={(v) => formatExp(v)}
        />
        <CompareKPI
          label="Best Day EXP"
          icon={Star}
          primaryValue={primary.kpis.bestDayEver.expGained}
          compareValue={compare.kpis.bestDayEver.expGained}
          primaryName={primary.character.name}
          compareName={compare.character.name}
          format={(v) => v > 0 ? formatExp(v) : '—'}
        />
        <CompareKPI
          label="Best Week EXP"
          icon={Calendar}
          primaryValue={primary.kpis.bestWeekEver.expGained}
          compareValue={compare.kpis.bestWeekEver.expGained}
          primaryName={primary.character.name}
          compareName={compare.character.name}
          format={(v) => v > 0 ? formatExp(v) : '—'}
        />
      </div>

      {/* Skill Comparison Table */}
      {skillComparison.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Skill Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 text-xs text-muted-foreground pb-2 border-b border-border/50">
                <span>Skill</span>
                <span className="text-center">{primary.character.name}</span>
                <span className="text-center">{compare.character.name}</span>
              </div>
              {skillComparison.map((skill) => {
                const pVal = skill.primary || 0;
                const cVal = skill.compare || 0;
                return (
                  <div key={skill.label} className="grid grid-cols-3 text-sm py-1.5">
                    <span className="text-muted-foreground">{skill.label}</span>
                    <span className={`text-center font-semibold ${pVal > cVal ? 'text-emerald-400' : ''}`}>
                      {skill.primary ?? '—'}
                    </span>
                    <span className={`text-center font-semibold ${cVal > pVal ? 'text-emerald-400' : ''}`}>
                      {skill.compare ?? '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stacked Heatmaps */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">EXP Heatmaps</h3>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{primary.character.name}</p>
          <TrainingHeatmap snapshots={primary.snapshots} />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{compare.character.name}</p>
          <TrainingHeatmap snapshots={compare.snapshots} />
        </div>
      </div>
    </div>
  );
}
