'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/formatters';

interface ExpChartProps {
  snapshots: Array<{
    capturedDate: string;
    experience: number | null;
    expGained: number | null;
    level: number | null;
  }>;
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function ExpChart({ snapshots }: ExpChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    const sortedSnapshots = [...snapshots].sort(
      (a, b) =>
        new Date(a.capturedDate).getTime() - new Date(b.capturedDate).getTime()
    );

    if (viewMode === 'daily') {
      return sortedSnapshots.map((snapshot) => ({
        date: new Date(snapshot.capturedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        expGained: snapshot.expGained || 0,
        level: snapshot.level,
        fullDate: snapshot.capturedDate,
      }));
    }

    if (viewMode === 'weekly') {
      const weeklyData = new Map<string, { expGained: number; level: number | null; date: Date }>();

      sortedSnapshots.forEach((snapshot) => {
        const date = new Date(snapshot.capturedDate);
        const year = date.getFullYear();
        const weekNumber = getWeekNumber(date);
        const key = `${year}-W${weekNumber}`;

        const existing = weeklyData.get(key);
        weeklyData.set(key, {
          expGained: (existing?.expGained || 0) + (snapshot.expGained || 0),
          level: snapshot.level,
          date: existing?.date || date,
        });
      });

      return Array.from(weeklyData.entries())
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .map(([key, value]) => ({
          date: `Week ${key.split('-W')[1]}`,
          expGained: value.expGained,
          level: value.level,
          fullDate: value.date.toISOString(),
        }));
    }

    if (viewMode === 'monthly') {
      const monthlyData = new Map<string, { expGained: number; level: number | null; date: Date }>();

      sortedSnapshots.forEach((snapshot) => {
        const date = new Date(snapshot.capturedDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const existing = monthlyData.get(key);
        monthlyData.set(key, {
          expGained: (existing?.expGained || 0) + (snapshot.expGained || 0),
          level: snapshot.level,
          date: existing?.date || date,
        });
      });

      return Array.from(monthlyData.entries())
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .map(([, value]) => ({
          date: value.date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          }),
          expGained: value.expGained,
          level: value.level,
          fullDate: value.date.toISOString(),
        }));
    }

    return [];
  }, [snapshots, viewMode]);

  const formatYAxis = (value: number) => {
    return formatNumber(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          <p className="text-xs font-medium text-foreground">{data.date}</p>
          <p className="text-xs text-muted-foreground">
            Exp Gained: <span className="font-semibold text-purple-400">{formatNumber(data.expGained)}</span>
          </p>
          {data.level && (
            <p className="text-xs text-muted-foreground">
              Level: <span className="font-semibold text-foreground">{data.level}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">Experience Over Time</CardTitle>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('daily')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'daily'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode('weekly')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'weekly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            }`}
          >
            Monthly
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No progression data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 40%, 20%)" />
              <XAxis
                dataKey="date"
                stroke="hsl(215, 20%, 65%)"
                tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(215, 20%, 65%)"
                tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="expGained"
                stroke="hsl(270, 70%, 60%)"
                strokeWidth={2}
                fill="url(#expGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
