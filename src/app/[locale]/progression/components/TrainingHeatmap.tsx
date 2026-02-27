'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { startOfWeek, addDays, format, subMonths, isBefore, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';

interface TrainingHeatmapProps {
  snapshots: Array<{
    capturedDate: string;
    expGained: number | null;
    level?: number | null;
    levelsGained?: number | null;
  }>;
}

export default function TrainingHeatmap({ snapshots }: TrainingHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{
    date: Date;
    expGained: number | null;
    levelsGained: number | null;
    level: number | null;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { gridData, monthLabels, intensityThresholds } = useMemo(() => {
    const endDate = new Date();
    const startDate = subMonths(endDate, 6);
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 });

    const dataMap = new Map<string, { exp: number; levelsGained: number; level: number }>();
    snapshots.forEach((snapshot) => {
      const dateKey = format(new Date(snapshot.capturedDate), 'yyyy-MM-dd');
      dataMap.set(dateKey, {
        exp: snapshot.expGained || 0,
        levelsGained: snapshot.levelsGained || 0,
        level: snapshot.level || 0,
      });
    });

    const values = Array.from(dataMap.values()).map(v => v.exp).filter((v) => v > 0).sort((a, b) => a - b);
    const thresholds = {
      low: values[Math.floor(values.length * 0.25)] || 0,
      medium: values[Math.floor(values.length * 0.5)] || 0,
      high: values[Math.floor(values.length * 0.75)] || 0,
    };

    const weeks: Array<Array<{ date: Date; expGained: number | null; levelsGained: number | null; level: number | null }>> = [];
    let currentDate = weekStart;
    let currentWeek: Array<{ date: Date; expGained: number | null; levelsGained: number | null; level: number | null }> = [];

    while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const entry = dataMap.get(dateKey);
      currentWeek.push({
        date: new Date(currentDate),
        expGained: entry?.exp ?? null,
        levelsGained: entry?.levelsGained ?? null,
        level: entry?.level ?? null,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentDate = addDays(currentDate, 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: addDays(currentDate, currentWeek.length), expGained: null, levelsGained: null, level: null });
      }
      weeks.push(currentWeek);
    }

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
    if (expGained === null || expGained === 0) return 'bg-[#1e1b2e] border border-[#2a2640]';
    if (expGained <= intensityThresholds.low) return 'bg-purple-900/60';
    if (expGained <= intensityThresholds.medium) return 'bg-purple-700/70';
    if (expGained <= intensityThresholds.high) return 'bg-purple-500/80';
    return 'bg-purple-400';
  };

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const totalWeeks = gridData.length;
  const DAY_LABEL_WIDTH = 36;
  const GAP = 3;

  // Calculate cell size dynamically to fill container width
  const availableWidth = containerWidth - DAY_LABEL_WIDTH - 8;
  const cellSize = totalWeeks > 0
    ? Math.max(10, Math.floor((availableWidth - (totalWeeks - 1) * GAP) / totalWeeks))
    : 14;
  const actualGridWidth = totalWeeks * cellSize + (totalWeeks - 1) * GAP;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">EXP Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative w-full overflow-visible">
          {containerWidth > 0 && (
            <div className="flex flex-col">
              {/* Month labels */}
              <div className="mb-1" style={{ marginLeft: `${DAY_LABEL_WIDTH + 8}px`, width: `${actualGridWidth}px`, position: 'relative', height: '18px' }}>
                {monthLabels.map((label, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-muted-foreground"
                    style={{
                      position: 'absolute',
                      left: `${label.weekIndex * (cellSize + GAP)}px`,
                    }}
                  >
                    {label.month}
                  </span>
                ))}
              </div>

              {/* Day labels + grid */}
              <div className="flex">
                {/* Day labels column */}
                <div className="flex flex-col flex-shrink-0 mr-2" style={{ width: `${DAY_LABEL_WIDTH}px`, minWidth: `${DAY_LABEL_WIDTH}px` }}>
                  {dayLabels.map((label, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground"
                      style={{ height: `${cellSize}px`, marginBottom: idx < 6 ? `${GAP}px` : 0 }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Heatmap cells */}
                <div className="flex" style={{ gap: `${GAP}px` }}>
                  {gridData.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col" style={{ gap: `${GAP}px` }}>
                      {week.map((day, dayIdx) => (
                        <div
                          key={dayIdx}
                          className={`rounded-sm cursor-pointer ${getIntensityClass(day.expGained)} ${
                            day.expGained !== null && day.expGained > 0
                              ? 'hover:ring-1 hover:ring-purple-400'
                              : 'hover:ring-1 hover:ring-border'
                          }`}
                          style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                          onMouseEnter={(e) => {
                            const rect = containerRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredCell({
                              date: day.date,
                              expGained: day.expGained,
                              levelsGained: day.levelsGained,
                              level: day.level,
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                            });
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
                <div className="flex gap-[3px]">
                  <div className="h-3 w-3 rounded-sm bg-[#1e1b2e] border border-[#2a2640]" />
                  <div className="h-3 w-3 rounded-sm bg-purple-900/60" />
                  <div className="h-3 w-3 rounded-sm bg-purple-700/70" />
                  <div className="h-3 w-3 rounded-sm bg-purple-500/80" />
                  <div className="h-3 w-3 rounded-sm bg-purple-400" />
                </div>
                <span className="text-xs text-muted-foreground">More</span>
              </div>
            </div>
          )}

          {/* Tooltip */}
          {hoveredCell && (
            <div
              className="pointer-events-none absolute z-50 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
              style={{
                left: `${Math.min(hoveredCell.x + 10, containerWidth - 200)}px`,
                top: `${hoveredCell.y + 10}px`,
              }}
            >
              <p className="text-xs font-medium text-foreground">
                {format(hoveredCell.date, 'EEEE, MMM d, yyyy')}
              </p>
              {hoveredCell.expGained !== null && hoveredCell.expGained > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    EXP Gained:{' '}
                    <span className="font-semibold text-purple-400">
                      {formatNumber(hoveredCell.expGained)}
                    </span>
                  </p>
                  {hoveredCell.levelsGained !== null && hoveredCell.levelsGained !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      Levels:{' '}
                      <span className={`font-semibold ${hoveredCell.levelsGained > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {hoveredCell.levelsGained > 0 ? '+' : ''}{hoveredCell.levelsGained}
                      </span>
                      {hoveredCell.level ? (
                        <span className="text-muted-foreground/60"> (Lvl {hoveredCell.level})</span>
                      ) : null}
                    </p>
                  )}
                  {hoveredCell.levelsGained === 0 && hoveredCell.level ? (
                    <p className="text-xs text-muted-foreground/60">
                      Level {hoveredCell.level}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  {hoveredCell.expGained === 0 ? 'No EXP gained' : 'No data recorded'}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
