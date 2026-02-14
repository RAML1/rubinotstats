'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Swords, Target, Shield } from 'lucide-react';

interface SkillGridProps {
  vocation: string;
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
  color: string;
  badgeColor: string;
}

const ALL_SKILLS: Omit<SkillCardData, 'current' | 'previous'>[] = [
  { key: 'magicLevel', name: 'Magic Level', icon: <Wand2 className="w-5 h-5" />, color: 'bg-purple-500', badgeColor: 'bg-purple-600' },
  { key: 'fist', name: 'Fist', icon: <Swords className="w-5 h-5" />, color: 'bg-orange-500', badgeColor: 'bg-orange-600' },
  { key: 'club', name: 'Club', icon: <Swords className="w-5 h-5" />, color: 'bg-orange-500', badgeColor: 'bg-orange-600' },
  { key: 'sword', name: 'Sword', icon: <Swords className="w-5 h-5" />, color: 'bg-orange-500', badgeColor: 'bg-orange-600' },
  { key: 'axe', name: 'Axe', icon: <Swords className="w-5 h-5" />, color: 'bg-orange-500', badgeColor: 'bg-orange-600' },
  { key: 'distance', name: 'Distance', icon: <Target className="w-5 h-5" />, color: 'bg-amber-500', badgeColor: 'bg-amber-600' },
  { key: 'shielding', name: 'Shielding', icon: <Shield className="w-5 h-5" />, color: 'bg-blue-500', badgeColor: 'bg-blue-600' },
];

function getRelevantSkillKeys(vocation: string): string[] {
  const voc = vocation.toLowerCase();
  if (voc.includes('monk')) return ['fist', 'magicLevel'];
  if (voc.includes('knight')) return ['shielding', 'sword', 'axe', 'club', 'magicLevel'];
  if (voc.includes('paladin')) return ['distance', 'magicLevel'];
  if (voc.includes('druid')) return ['magicLevel'];
  if (voc.includes('sorcerer')) return ['magicLevel'];
  return ALL_SKILLS.map((s) => s.key);
}

export default function SkillGrid({ vocation, currentSkills, previousSkills }: SkillGridProps) {
  const skills = useMemo((): SkillCardData[] => {
    if (!currentSkills) return [];

    const relevantKeys = getRelevantSkillKeys(vocation);

    return ALL_SKILLS
      .filter((s) => relevantKeys.includes(s.key))
      .map((s) => ({
        ...s,
        current: currentSkills[s.key as keyof typeof currentSkills],
        previous: previousSkills?.[s.key as keyof typeof previousSkills] ?? null,
      }));
  }, [currentSkills, previousSkills, vocation]);

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

            return (
              <div
                key={skill.key}
                className="rounded-lg border border-border/30 bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
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
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
