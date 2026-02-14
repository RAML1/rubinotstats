'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SkillDistributionProps {
  snapshots: Array<{
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    fishing: number | null;
  }>;
}

interface SkillData {
  name: string;
  value: number;
  color: string;
}

const SKILL_CONFIG = {
  magicLevel: { name: 'Magic Level', color: '#a855f7' },
  fist: { name: 'Fist', color: '#f97316' },
  club: { name: 'Club', color: '#f97316' },
  sword: { name: 'Sword', color: '#f97316' },
  axe: { name: 'Axe', color: '#f97316' },
  distance: { name: 'Distance', color: '#f59e0b' },
  shielding: { name: 'Shielding', color: '#3b82f6' },
  fishing: { name: 'Fishing', color: '#06b6d4' },
};

export default function SkillDistribution({ snapshots }: SkillDistributionProps) {
  const chartData = useMemo((): SkillData[] => {
    if (!snapshots || snapshots.length === 0) return [];

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    if (!firstSnapshot || !lastSnapshot) return [];

    const skillGains: Record<string, number> = {};
    let hasValidGains = false;

    Object.keys(SKILL_CONFIG).forEach((skillKey) => {
      const firstValue = firstSnapshot[skillKey as keyof typeof firstSnapshot] ?? 0;
      const lastValue = lastSnapshot[skillKey as keyof typeof firstSnapshot] ?? 0;
      const gain = lastValue - firstValue;

      if (gain > 0) {
        skillGains[skillKey] = gain;
        hasValidGains = true;
      }
    });

    if (!hasValidGains) return [];

    return Object.entries(skillGains).map(([skillKey, gain]) => ({
      name: SKILL_CONFIG[skillKey as keyof typeof SKILL_CONFIG].name,
      value: gain,
      color: SKILL_CONFIG[skillKey as keyof typeof SKILL_CONFIG].color,
    }));
  }, [snapshots]);

  const totalGain = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-secondary/95 border border-border/50 rounded-lg p-2 backdrop-blur">
          <p className="text-sm font-semibold text-foreground">{data.payload.name}</p>
          <p className="text-sm text-muted-foreground">
            +{data.value} points
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, percent }: any) => {
    if (percent < 0.05) return null;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-bold fill-white"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Training Focus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            Not enough data to show distribution
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle>Training Focus</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={60}
                outerRadius={90}
                label={<CustomLabel />}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground">
              Total Skill Points Gained: <span className="text-foreground font-bold">{totalGain}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {chartData.map((skill) => {
                const percentage = ((skill.value / totalGain) * 100).toFixed(1);
                return (
                  <div key={skill.name} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: skill.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {skill.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        +{skill.value} ({percentage}%)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
