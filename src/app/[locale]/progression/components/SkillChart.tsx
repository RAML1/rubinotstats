'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Swords } from 'lucide-react';

interface SnapshotData {
  capturedDate: string;
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;
  charmPoints: number | null;
  bountyPoints: number | null;
}

interface SkillChartProps {
  snapshots: SnapshotData[];
  vocation: string;
}

const SKILL_CONFIG: Record<string, { label: string; color: string }> = {
  magicLevel: { label: 'Magic Level', color: '#a855f7' },
  fist: { label: 'Fist', color: '#f97316' },
  club: { label: 'Club', color: '#fb923c' },
  sword: { label: 'Sword', color: '#ef4444' },
  axe: { label: 'Axe', color: '#dc2626' },
  distance: { label: 'Distance', color: '#f59e0b' },
  shielding: { label: 'Shielding', color: '#3b82f6' },
  fishing: { label: 'Fishing', color: '#06b6d4' },
  charmPoints: { label: 'Charm Points', color: '#ec4899' },
  bountyPoints: { label: 'Bounty Points', color: '#84cc16' },
};

function getDefaultSkill(vocation: string): string {
  const voc = vocation.toLowerCase();
  if (voc.includes('knight')) return 'sword';
  if (voc.includes('paladin')) return 'distance';
  if (voc.includes('druid') || voc.includes('sorcerer')) return 'magicLevel';
  if (voc.includes('monk')) return 'fist';
  return 'magicLevel';
}

function getAvailableSkills(snapshots: SnapshotData[]): string[] {
  const skills = Object.keys(SKILL_CONFIG);
  return skills.filter((skill) =>
    snapshots.some((s) => {
      const val = s[skill as keyof SnapshotData];
      return val !== null && val !== undefined && val !== 0;
    })
  );
}

export default function SkillChart({ snapshots, vocation }: SkillChartProps) {
  const availableSkills = useMemo(() => getAvailableSkills(snapshots), [snapshots]);
  const defaultSkill = useMemo(() => {
    const preferred = getDefaultSkill(vocation);
    return availableSkills.includes(preferred) ? preferred : availableSkills[0] || 'magicLevel';
  }, [vocation, availableSkills]);

  const [selectedSkill, setSelectedSkill] = useState<string>(defaultSkill);

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.capturedDate).getTime() - new Date(b.capturedDate).getTime()
    );

    return sorted
      .filter((s) => {
        const val = s[selectedSkill as keyof SnapshotData];
        return val !== null && val !== undefined;
      })
      .map((s) => ({
        date: new Date(s.capturedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        value: s[selectedSkill as keyof SnapshotData] as number,
        fullDate: s.capturedDate,
      }));
  }, [snapshots, selectedSkill]);

  const skillColor = SKILL_CONFIG[selectedSkill]?.color || '#a855f7';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: 'rgba(15, 15, 26, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          <p className="text-[11px] font-medium text-white/90">{data.date}</p>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {SKILL_CONFIG[selectedSkill]?.label}:{' '}
            <span className="font-semibold" style={{ color: skillColor }}>
              {(selectedSkill === 'charmPoints' || selectedSkill === 'bountyPoints') ? data.value.toLocaleString() : data.value}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (availableSkills.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Swords size={20} className="text-primary" />
          Skill Progression
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          {availableSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedSkill(skill)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedSkill === skill
                  ? 'text-white'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
              style={selectedSkill === skill ? { backgroundColor: SKILL_CONFIG[skill]?.color } : undefined}
            >
              {SKILL_CONFIG[skill]?.label || skill}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Not enough data points to show progression
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <filter id="skillGlow" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin - 1', 'dataMax + 1']}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={skillColor}
                strokeWidth={2.5}
                dot={{ r: 4, fill: skillColor, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: skillColor, strokeWidth: 2, stroke: '#fff' }}
                style={{ filter: 'url(#skillGlow)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
