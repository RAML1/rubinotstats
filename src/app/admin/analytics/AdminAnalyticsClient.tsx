'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  Eye,
  Users,
  Globe,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
  overview: {
    totalVisitors: number;
    totalSessions: number;
    visitorsToday: number;
    visitorsWeek: number;
    visitorsMonth: number;
    pageViewsToday: number;
    pageViewsWeek: number;
    pageViewsMonth: number;
  };
  topPages: { path: string; views: number }[];
  countries: { country: string; visitors: number }[];
  languages: { language: string; visitors: number }[];
  referrers: { referrer: string; visitors: number }[];
  daily: { day: string; views: number; visitors: number }[];
  recentSearches: { query: string; pagePath: string; createdAt: string }[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Eye;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <Icon className={`h-6 w-6 ${color}`} />
        <div>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function DailyChart({ daily }: { daily: AnalyticsData['daily'] }) {
  if (daily.length === 0) return null;
  const maxViews = Math.max(...daily.map((d) => d.views), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-sky-400" />
        Daily Page Views (Last 14 Days)
      </h3>
      <div className="flex items-end gap-1 h-40">
        {daily.map((d) => {
          const heightPct = (d.views / maxViews) * 100;
          const dayLabel = new Date(d.day + 'T12:00:00').toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
          });
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex justify-center">
                <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-muted-foreground whitespace-nowrap">
                  {d.views} views / {d.visitors} visitors
                </div>
              </div>
              <div
                className="w-full rounded-t-sm bg-sky-500/80 hover:bg-sky-400 transition-colors min-h-[2px]"
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[8px] text-muted-foreground leading-none">
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({
  title,
  icon: Icon,
  iconColor,
  headers,
  rows,
}: {
  title: string;
  icon: typeof Globe;
  iconColor: string;
  headers: [string, string];
  rows: [string, number][];
}) {
  if (rows.length === 0) return null;
  const maxVal = Math.max(...rows.map((r) => r[1]), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title}
      </h3>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">
          <span>{headers[0]}</span>
          <span>{headers[1]}</span>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="relative rounded-md px-2 py-1.5">
            <div
              className="absolute inset-0 rounded-md bg-primary/5"
              style={{ width: `${(value / maxVal) * 100}%` }}
            />
            <div className="relative flex items-center justify-between">
              <span className="text-xs truncate mr-2">{label}</span>
              <span className="text-xs font-semibold shrink-0">{value.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AdminAnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/analytics/stats');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchData(), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BarChart3 className="h-6 w-6 text-emerald-400" />
          <h1 className="text-2xl font-bold">Analytics</h1>
          <span className="text-xs text-muted-foreground">Auto-refreshes every 60s</span>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors Today" value={data.overview.visitorsToday} icon={Users} color="text-emerald-400" />
        <StatCard label="Page Views Today" value={data.overview.pageViewsToday} icon={Eye} color="text-sky-400" />
        <StatCard label="Visitors This Week" value={data.overview.visitorsWeek} icon={Users} color="text-violet-400" />
        <StatCard label="Page Views This Week" value={data.overview.pageViewsWeek} icon={Eye} color="text-orange-400" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors This Month" value={data.overview.visitorsMonth} icon={Users} color="text-pink-400" />
        <StatCard label="Page Views This Month" value={data.overview.pageViewsMonth} icon={Eye} color="text-amber-400" />
        <StatCard label="Total Unique Visitors" value={data.overview.totalVisitors} icon={Users} color="text-blue-400" />
        <StatCard label="Total Sessions" value={data.overview.totalSessions} icon={BarChart3} color="text-teal-400" />
      </div>

      {/* Daily chart */}
      <DailyChart daily={data.daily} />

      {/* Data tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Top Pages (30 Days)"
          icon={Eye}
          iconColor="text-sky-400"
          headers={['Page', 'Views']}
          rows={data.topPages.map((p) => [p.path, p.views])}
        />
        <DataTable
          title="Countries"
          icon={Globe}
          iconColor="text-emerald-400"
          headers={['Country', 'Visitors']}
          rows={data.countries.map((c) => [c.country, c.visitors])}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Referrers"
          icon={Globe}
          iconColor="text-violet-400"
          headers={['Source', 'Visitors']}
          rows={data.referrers.map((r) => [r.referrer, r.visitors])}
        />
        <DataTable
          title="Languages"
          icon={Globe}
          iconColor="text-orange-400"
          headers={['Language', 'Visitors']}
          rows={data.languages.map((l) => [l.language, l.visitors])}
        />
      </div>

      {/* Recent searches */}
      {data.recentSearches.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-amber-400" />
            Recent Searches
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">
              <span>Query</span>
              <span>When</span>
            </div>
            {data.recentSearches.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium truncate">{s.query}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{s.pagePath}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                  {timeAgo(s.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
