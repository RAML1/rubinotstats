'use client';

import { useMemo, useState } from 'react';
import { startOfWeek, addDays, format, subMonths, isAfter, isBefore, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';

interface TrainingHeatmapProps {
  snapshots: Array<{
    capturedDate: string;
    expGained: number | null;
  }>;
}

export default function TrainingHeatmap({ snapshots }: TrainingHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    date: Date;
    expGained: number;
    x: number;
    y: number;
  } | null>(null);

  const { gridData, monthLabels, intensityThresholds } = useMemo(() => {
    const endDate = new Date();
    const startDate = subMonths(endDate, 6);
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 });

    // Create a map of date -> expGained
    const dataMap = new Map<string, number>();
    snapshots.forEach((snapshot) => {
      const dateKey = format(new Date(snapshot.capturedDate), 'yyyy-MM-dd');
      dataMap.set(dateKey, snapshot.expGained || 0);
    });

    // Calculate intensity thresholds
    const values = Array.from(dataMap.values()).filter((v) => v > 0).sort((a, b) => a - b);
    const thresholds = {
      low: values[Math.floor(values.length * 0.25)] || 0,
      medium: values[Math.floor(values.length * 0.5)] || 0,
      high: values[Math.floor(values.length * 0.75)] || 0,
    };

    // Build grid data
    const weeks: Array<Array<{ date: Date; expGained: number | null }>> = [];
    let currentDate = weekStart;
    let currentWeek: Array<{ date: Date; expGained: number | null }> = [];

    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const expGained = dataMap.get(dateKey) || null;

      currentWeek.push({ date: new Date(currentDate), expGained });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentDate = addDays(currentDate, 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: new Date(), expGained: null });
      }
      weeks.push(currentWeek);
    }

    // Calculate month labels
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0].date;
      const month = firstDay.getMonth();

      if (month !== lastMonth) {
        labels.push({
          month: format(firstDay, 'MMM'),
          weekIndex,
        });
        lastMonth = month;
      }
    });

    return {
      gridData: weeks,
      monthLabels: labels,
      intensityThresholds: thresholds,
    };
  }, [snapshots]);

  const getIntensityClass = (expGained: number | null) => {
    if (expGained === null || expGained === 0) {
      return 'bg-secondary/30';
    }

    if (expGained <= intensityThresholds.low) {
      return 'bg-purple-900/60';
    }
    if (expGained <= intensityThresholds.medium) {
      return 'bg-purple-700/70';
    }
    if (expGained <= intensityThresholds.high) {
      return 'bg-purple-500/80';
    }
    return 'bg-purple-400';
  };

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Training Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Month labels */}
          <div className="mb-2 flex" style={{ paddingLeft: '32px' }}>
            {monthLabels.map((label, idx) => (
              <div
                key={idx}
                className="text-xs text-muted-foreground"
                style={{
                  position: 'absolute',
                  left: `${32 + label.weekIndex * 14}px`,
                }}
              >
                {label.month}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-2">
            {/* Day labels */}
            <div className="flex flex-col gap-[2px]">
              {dayLabels.map((label, idx) => (
                <div
                  key={idx}
                  className="flex h-3 w-6 items-center text-[10px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="flex gap-[2px] overflow-x-auto">
              {gridData.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[2px]">
                  {week.map((day, dayIdx) => {
                    const isValid = isAfter(day.date, subMonths(new Date(), 6));
                    return (
                      <div
                        key={dayIdx}
                        className={`h-3 w-3 rounded-sm transition-all ${
                          isValid ? getIntensityClass(day.expGained) : 'bg-transparent'
                        } ${isValid ? 'cursor-pointer hover:ring-1 hover:ring-purple-400' : ''}`}
                        onMouseEnter={(e) => {
                          if (isValid && day.expGained !== null) {
                            setHoveredCell({
                              date: day.date,
                              expGained: day.expGained,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-[2px]">
              <div className="h-3 w-3 rounded-sm bg-secondary/30" />
              <div className="h-3 w-3 rounded-sm bg-purple-900/60" />
              <div className="h-3 w-3 rounded-sm bg-purple-700/70" />
              <div className="h-3 w-3 rounded-sm bg-purple-500/80" />
              <div className="h-3 w-3 rounded-sm bg-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <div
              className="pointer-events-none fixed z-50 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
              style={{
                left: `${hoveredCell.x + 10}px`,
                top: `${hoveredCell.y + 10}px`,
              }}
            >
              <p className="text-xs font-medium text-foreground">
                {format(hoveredCell.date, 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                Exp Gained:{' '}
                <span className="font-semibold text-purple-400">
                  {formatNumber(hoveredCell.expGained)}
                </span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
