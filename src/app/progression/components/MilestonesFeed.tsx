'use client';

import { Star, Swords, Trophy, Medal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Milestone {
  type: 'level' | 'skill' | 'rank';
  title: string;
  description: string;
  date: string;
  icon?: string;
}

interface MilestonesFeedProps {
  milestones: Milestone[];
}

const iconMap = {
  level: Star,
  skill: Swords,
  rank: Trophy,
};

const colorMap = {
  level: {
    dot: 'bg-emerald-500',
    dotRing: 'ring-emerald-500/30',
  },
  skill: {
    dot: 'bg-purple-500',
    dotRing: 'ring-purple-500/30',
  },
  rank: {
    dot: 'bg-amber-500',
    dotRing: 'ring-amber-500/30',
  },
};

export default function MilestonesFeed({ milestones }: MilestonesFeedProps) {
  const isEmpty = !milestones || milestones.length === 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-amber-400" />
          Milestones
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 p-3 rounded-lg bg-muted">
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              No milestones recorded yet
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Keep training to reach your first milestone!
            </p>
          </div>
        ) : (
          <div className="space-y-0 max-h-[400px] overflow-y-auto pr-2">
            {/* Custom scrollbar styling */}
            <style jsx>{`
              ::-webkit-scrollbar {
                width: 6px;
              }
              ::-webkit-scrollbar-track {
                background: transparent;
              }
              ::-webkit-scrollbar-thumb {
                background: hsl(var(--muted-foreground) / 0.3);
                border-radius: 3px;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: hsl(var(--muted-foreground) / 0.5);
              }
            `}</style>

            {/* Timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-border/50 ml-7 translate-x-1/2" />

            {milestones.map((milestone, index) => {
              const IconComponent = iconMap[milestone.type] || Star;
              const colors = colorMap[milestone.type];
              const relativeDate = formatDistanceToNow(new Date(milestone.date), {
                addSuffix: true,
              });

              return (
                <div key={index} className="relative pl-20 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1 w-4 h-4 -translate-x-1.5">
                    <div
                      className={`w-full h-full rounded-full ${colors.dot} shadow-lg ring-4 ${colors.dotRing}`}
                    />
                  </div>

                  {/* Milestone entry */}
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/30 hover:border-border/60 transition-colors group">
                    {/* Header with icon and title */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground">
                            {milestone.title}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {milestone.description}
                          </p>
                        </div>
                      </div>

                      {/* Relative date */}
                      <div className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {relativeDate}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
