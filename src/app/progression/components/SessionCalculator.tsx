'use client';

import { Card } from '@/components/ui/card';
import { Calculator, Target, Clock } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import { addDays, format } from 'date-fns';
import { useState, useMemo } from 'react';

interface SessionCalculatorProps {
  currentLevel: number | null;
  currentExp: number | null;
  avgDailyExp: number | null;
  avgWeeklyExp: number | null;
}

export function SessionCalculator({
  currentLevel,
  currentExp,
  avgDailyExp,
  avgWeeklyExp,
}: SessionCalculatorProps) {
  const [targetLevel, setTargetLevel] = useState<number | string>('');

  const hasData = avgDailyExp && avgDailyExp > 0;

  const calculations = useMemo(() => {
    if (!hasData || !targetLevel || targetLevel === '') {
      return null;
    }

    const target = typeof targetLevel === 'string' ? parseInt(targetLevel, 10) : targetLevel;

    if (isNaN(target) || target <= (currentLevel || 0)) {
      return null;
    }

    // Simple formula: expForLevel = 50 * level^3 / 3
    const expForCurrentLevel = (50 * Math.pow(currentLevel || 1, 3)) / 3;
    const expForTarget = (50 * Math.pow(target, 3)) / 3;
    const expNeeded = expForTarget - expForCurrentLevel;

    const daysNeeded = Math.ceil(expNeeded / (avgDailyExp || 1));
    const weeksNeeded = Math.ceil(expNeeded / (avgWeeklyExp || 1));

    const estimatedDate = addDays(new Date(), daysNeeded);
    const formattedDate = format(estimatedDate, 'MMMM d, yyyy');

    return {
      expNeeded,
      daysNeeded,
      weeksNeeded,
      estimatedDate: formattedDate,
    };
  }, [targetLevel, currentLevel, avgDailyExp, avgWeeklyExp, hasData]);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <div className="flex items-center gap-2 mb-6 p-6 pb-0">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Pace Calculator</h2>
      </div>

      <div className="p-6 space-y-6">
        {!hasData ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Not enough data to estimate. Keep playing!
            </p>
          </div>
        ) : (
          <>
            {/* Target Level Input */}
            <div className="space-y-2">
              <label htmlFor="targetLevel" className="text-sm font-medium">
                Target Level
              </label>
              <input
                id="targetLevel"
                type="number"
                min={currentLevel ? currentLevel + 1 : 1}
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                placeholder="Enter target level"
                className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Results Grid */}
            {calculations && (
              <div className="space-y-4">
                <div className="bg-background/50 rounded-lg p-4 space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    At your current pace
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-3xl font-bold text-primary">
                        ~{calculations.daysNeeded}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">days</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-primary">
                        ~{calculations.weeksNeeded}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">weeks</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/30 pt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Target</span>
                    <span className="text-sm text-primary">Level {targetLevel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      Estimated
                    </span>
                    <span className="text-sm text-primary">
                      {calculations.estimatedDate}
                    </span>
                  </div>
                </div>

                {/* Current Stats */}
                <div className="border-t border-border/30 pt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Avg Daily</span>
                    <span>{formatNumber(avgDailyExp)} exp</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Weekly</span>
                    <span>{formatNumber(avgWeeklyExp || 0)} exp</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
