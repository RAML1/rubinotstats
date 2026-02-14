'use client';

import { Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, formatDate } from '@/lib/utils/formatters';

interface BestRecordsProps {
  bestDay: {
    date: string;
    expGained: number;
    levelsGained: number;
  } | null;
  bestWeek: {
    startDate: string;
    endDate: string;
    expGained: number;
    levelsGained: number;
  } | null;
}

export default function BestRecords({ bestDay, bestWeek }: BestRecordsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Best Day Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur relative overflow-hidden group hover:border-amber-500/50 transition-colors">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <CardHeader className="relative z-10 pb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <CardTitle className="text-lg">Best Day</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          {bestDay ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {formatDate(new Date(bestDay.date))}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-amber-400">
                    {formatNumber(bestDay.expGained)}
                  </span>
                  <span className="text-sm text-muted-foreground">EXP</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="secondary"
                  className="bg-amber-500/20 text-amber-300 border-amber-500/30"
                >
                  +{bestDay.levelsGained} {bestDay.levelsGained === 1 ? 'level' : 'levels'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No records yet</p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Keep training to set your first record!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best Week Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur relative overflow-hidden group hover:border-purple-500/50 transition-colors">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <CardHeader className="relative z-10 pb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-purple-400" />
            <CardTitle className="text-lg">Best Week</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10">
          {bestWeek ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {formatDate(new Date(bestWeek.startDate))} -{' '}
                  {formatDate(new Date(bestWeek.endDate))}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-purple-400">
                    {formatNumber(bestWeek.expGained)}
                  </span>
                  <span className="text-sm text-muted-foreground">EXP</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-300 border-purple-500/30"
                >
                  +{bestWeek.levelsGained} {bestWeek.levelsGained === 1 ? 'level' : 'levels'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No records yet</p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                Keep training to set your first record!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
