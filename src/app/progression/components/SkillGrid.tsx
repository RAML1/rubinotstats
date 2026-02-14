'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Swords, Target, Shield, Fish } from 'lucide-react';

interface SkillGridProps {
  currentSkills: {
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    fishing: number | null;
  } | null;
  previousSkills: {
    magicLevel: number | null;
    fist: number | null;
    club: number | null;
    sword: number | null;
    axe: number | null;
    distance: number | null;
    shielding: number | null;
    fishing: number | null;
  } | null;
}

interface SkillCardData {
  key: string;
  name: string;
  current: number | null;
  previous: number | null;
  icon: React.ReactNode;
  maxLevel: number;
  color: string;
  badgeColor: string;
}

export default function SkillGrid({ currentSkills, previousSkills }: SkillGridProps) {
  const skills = useMemo((): SkillCardData[] => {
    if (!currentSkills) return [];

    return [
      {
        key: 'magicLevel',
        name: 'Magic Level',
        current: currentSkills.magicLevel,
        previous: previousSkills?.magicLevel ?? null,
        icon: <Wand2 className="w-5 h-5" />,
        maxLevel: 50,
        color: 'bg-purple-500',
        badgeColor: 'bg-purple-600',
      },
      {
        key: 'fist',
        name: 'Fist',
        current: currentSkills.fist,
        previous: previousSkills?.fist ?? null,
        icon: <Swords className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-orange-500',
        badgeColor: 'bg-orange-600',
      },
      {
        key: 'club',
        name: 'Club',
        current: currentSkills.club,
        previous: previousSkills?.club ?? null,
        icon: <Swords className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-orange-500',
        badgeColor: 'bg-orange-600',
      },
      {
        key: 'sword',
        name: 'Sword',
        current: currentSkills.sword,
        previous: previousSkills?.sword ?? null,
        icon: <Swords className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-orange-500',
        badgeColor: 'bg-orange-600',
      },
      {
        key: 'axe',
        name: 'Axe',
        current: currentSkills.axe,
        previous: previousSkills?.axe ?? null,
        icon: <Swords className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-orange-500',
        badgeColor: 'bg-orange-600',
      },
      {
        key: 'distance',
        name: 'Distance',
        current: currentSkills.distance,
        previous: previousSkills?.distance ?? null,
        icon: <Target className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-amber-500',
        badgeColor: 'bg-amber-600',
      },
      {
        key: 'shielding',
        name: 'Shielding',
        current: currentSkills.shielding,
        previous: previousSkills?.shielding ?? null,
        icon: <Shield className="w-5 h-5" />,
        maxLevel: 150,
        color: 'bg-blue-500',
        badgeColor: 'bg-blue-600',
      },
      {
        key: 'fishing',
        name: 'Fishing',
        current: currentSkills.fishing,
        previous: previousSkills?.fishing ?? null,
        icon: <Fish className="w-5 h-5" />,
        maxLevel: 30,
        color: 'bg-cyan-500',
        badgeColor: 'bg-cyan-600',
      },
    ];
  }, [currentSkills, previousSkills]);

  const getStatusBadgeColor = (current: number | null, previous: number | null) => {
    if (current === null) return 'bg-gray-600';
    if (previous === null) return 'bg-orange-500';
    if (current > previous) return 'bg-emerald-500';
    if (current < previous) return 'bg-red-500';
    return 'bg-orange-500';
  };

  const getChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null;
    const change = current - previous;
    if (change === 0) return null;
    return change;
  };

  if (!currentSkills) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Combat Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            Search for a character to view skills
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle>Combat Skills</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {skills.map((skill) => {
            const change = getChange(skill.current, skill.previous);
            const badgeColor = getStatusBadgeColor(skill.current, skill.previous);
            const progressPercent = skill.current
              ? Math.min((skill.current / skill.maxLevel) * 100, 100)
              : 0;

            return (
              <div
                key={skill.key}
                className="rounded-lg border border-border/30 bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`${badgeColor} rounded-lg p-2 text-white font-bold text-lg w-14 h-14 flex items-center justify-center`}>
                    {skill.current ?? '-'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{skill.icon}</span>
                      <h3 className="font-semibold text-sm">{skill.name}</h3>
                    </div>
                    {change !== null && (
                      <div className={`text-xs font-semibold ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {change > 0 ? '+' : ''}{change}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="text-foreground font-medium">
                      {skill.current ?? 0} / {skill.maxLevel}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${skill.color} transition-all duration-300`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
