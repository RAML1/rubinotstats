'use client';

import { useMemo, useState } from 'react';
import { startOfWeek, addDays, format, subMonths, isBefore, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';

interface TrainingHeatmapProps {
  snapshots: Array<{
    capturedDate: string;
    expGained: number | null;
  }>;
}

const CELL_SIZE = 11;
const CELL_GAP = 2;

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

    const dataMap = new Map<string, number>();
    snapshots.forEach((snapshot) => {
      const dateKey = format(new Date(snapshot.capturedDate), 'yyyy-MM-dd');
      dataMap.set(dateKey, snapshot.expGained || 0);
    });

    const values = Array.from(dataMap.values()).filter((v) => v > 0).sort((a, b) => a - b);
    const thresholds = {
      low: values[Math.floor(values.length * 0.25)] || 0,
      medium: values[Math.floor(values.length * 0.5)] || 0,
      high: values[Math.floor(values.length * 0.75)] || 0,
    };

    const weeks: Array<Array<{ date: Date; expGained: number | null }>> = [];
    let currentDate = weekStart;
    let currentWeek: Array<{ date: Date; expGained: number | null }> = [];

    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const expGained = dataMap.get(dateKey) ?? null;
      currentWeek.push({ date: new Date(currentDate), expGained });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentDate = addDays(currentDate, 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: addDays(currentDate, currentWeek.length), expGained: null });
      }
      weeks.push(currentWeek);
    }

    // Month labels positioned by week index
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({ month: format(week[0].date, 'MMM'), weekIndex });
        lastMonth = month;
      }
    });

    return { gridData: weeks, monthLabels: labels, intensityThresholds: thresholds };
  }, [snapshots]);

  const getIntensityClass = (expGained: number | null) => {
    if (expGained === null || expGained === 0) return 'bg-[#1a1a2e]';
    if (expGained <= intensityThresholds.low) return 'bg-purple-900/60';
    if (expGained <= intensityThresholds.medium) return 'bg-purple-700/70';
    if (expGained <= intensityThresholds.high) return 'bg-purple-500/80';
    return 'bg-purple-400';
  };

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const totalWeeks = gridData.length;
  const gridWidthPx = totalWeeks * CELL_SIZE + (totalWeeks - 1) * CELL_GAP;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">EXP Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col">
            {/* Month labels — positioned using left offset within a fixed-width container */}
            <div className="flex mb-1" style={{ marginLeft: '36px', width: `${gridWidthPx}px`, position: 'relative', height: '18px' }}>
              {monthLabels.map((label, idx) => (
                <span
                  key={idx}
                  className="text-xs text-muted-foreground"
                  style={{
                    position: 'absolute',
                    left: `${label.weekIndex * (CELL_SIZE + CELL_GAP)}px`,
                  }}
                >
                  {label.month}
                </span>
              ))}
            </div>

            {/* Day labels + grid */}
            <div className="flex">
              {/* Day labels column */}
              <div className="flex flex-col flex-shrink-0 mr-2" style={{ width: '28px' }}>
                {dayLabels.map((label, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground"
                    style={{ height: `${CELL_SIZE}px`, marginBottom: idx < 6 ? `${CELL_GAP}px` : 0 }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Heatmap cells */}
              <div className="flex" style={{ gap: `${CELL_GAP}px` }}>
                {gridData.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col" style={{ gap: `${CELL_GAP}px` }}>
                    {week.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={`rounded-sm ${getIntensityClass(day.expGained)} ${
                          day.expGained !== null && day.expGained > 0
                            ? 'cursor-pointer hover:ring-1 hover:ring-purple-400'
                            : ''
                        }`}
                        style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                        onMouseEnter={(e) => {
                          if (day.expGained !== null && day.expGained > 0) {
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
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Less</span>
              <div className="flex gap-[2px]">
                <div className="h-3 w-3 rounded-sm bg-[#1a1a2e]" />
                <div className="h-3 w-3 rounded-sm bg-purple-900/60" />
                <div className="h-3 w-3 rounded-sm bg-purple-700/70" />
                <div className="h-3 w-3 rounded-sm bg-purple-500/80" />
                <div className="h-3 w-3 rounded-sm bg-purple-400" />
              </div>
              <span className="text-xs text-muted-foreground">More</span>
            </div>
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
                EXP Gained:{' '}
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
