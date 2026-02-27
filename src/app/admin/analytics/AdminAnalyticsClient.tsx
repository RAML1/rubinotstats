'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  Eye,
  Users,
  Globe,
  Search,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ShoppingCart,
  Gavel,
  Shield,
  MessageCircle,
  TrendingUp,
  ArrowRightLeft,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────

interface DashboardData {
  traffic: {
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
  };
  auctions: {
    total: number;
    active: number;
    statusBreakdown: { status: string; count: number }[];
    avgSoldPrice: number;
    vocationBreakdown: { vocation: string; total: number; sold: number; avgPrice: number }[];
    dailyNew: { day: string; count: number }[];
    worldDistribution: { world: string; count: number }[];
  };
  users: {
    total: number;
    premium: number;
    pendingRequests: number;
  };
  gameData: {
    totalBans: number;
    activeBans: number;
    totalTransfers: number;
    topTransferRoutes: { from: string; to: string; count: number }[];
  };
  community: {
    featureRequests: number;
    feedback: number;
    activeListings: number;
  };
}

// ── Constants ────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

const STATUS_COLORS: Record<string, string> = {
  sold: '#10b981',
  expired: '#6b7280',
  active: '#3b82f6',
  scheduled: '#f59e0b',
  cancelled: '#ef4444',
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

function formatDay(day: string): string {
  return new Date(day + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── Reusable Components ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: typeof Eye;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color} shrink-0`} />
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{typeof value === 'number' ? formatNum(value) : value}</p>
          <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[9px] text-muted-foreground/60">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, color, title }: { icon: typeof Eye; color: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className || ''}`}>
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DataRow({ label, value, maxVal }: { label: string; value: number; maxVal: number }) {
  return (
    <div className="relative rounded-md px-2 py-1.5">
      <div
        className="absolute inset-0 rounded-md bg-primary/5"
        style={{ width: `${(value / Math.max(maxVal, 1)) * 100}%` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs truncate mr-2">{label}</span>
        <span className="text-xs font-semibold shrink-0">{formatNum(value)}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatNum(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function AdminAnalyticsClient() {
  const [data, setData] = useState<DashboardData | null>(null);
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
        Failed to load dashboard data.
      </div>
    );
  }

  const { traffic, auctions, users, gameData, community } = data;

  // Prep auction status for pie chart
  const statusPieData = auctions.statusBreakdown.map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
    fill: STATUS_COLORS[s.status] || '#6b7280',
  }));

  // Prep daily traffic for area chart
  const dailyTraffic = traffic.daily.map((d) => ({
    ...d,
    label: formatDay(d.day),
  }));

  // Prep daily auctions for bar chart
  const dailyAuctions = auctions.dailyNew.map((d) => ({
    ...d,
    label: formatDay(d.day),
  }));

  // Prep vocation data for bar chart
  const vocationData = auctions.vocationBreakdown.slice(0, 8).map((v) => ({
    name: v.vocation.replace('Royal ', 'R.').replace('Elite ', 'E.').replace('Master ', 'M.').replace('Elder ', 'El.').replace('Exalted ', 'Ex.'),
    fullName: v.vocation,
    total: v.total,
    sold: v.sold,
    avgPrice: v.avgPrice,
  }));

  return (
    <div className="container mx-auto space-y-5 px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BarChart3 className="h-6 w-6 text-emerald-400" />
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-[10px] text-muted-foreground bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            LIVE
          </span>
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TRAFFIC SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Eye} color="text-sky-400" title="Traffic" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Visitors Today" value={traffic.overview.visitorsToday} icon={Users} color="text-emerald-400" />
        <StatCard label="Page Views Today" value={traffic.overview.pageViewsToday} icon={Eye} color="text-sky-400" />
        <StatCard label="Visitors This Week" value={traffic.overview.visitorsWeek} icon={Users} color="text-violet-400" />
        <StatCard label="Page Views This Week" value={traffic.overview.pageViewsWeek} icon={Eye} color="text-orange-400" />
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Visitors This Month" value={traffic.overview.visitorsMonth} icon={Users} color="text-pink-400" />
        <StatCard label="Page Views This Month" value={traffic.overview.pageViewsMonth} icon={Eye} color="text-amber-400" />
        <StatCard label="Total Unique Visitors" value={traffic.overview.totalVisitors} icon={Users} color="text-blue-400" />
        <StatCard label="Total Sessions" value={traffic.overview.totalSessions} icon={BarChart3} color="text-teal-400" />
      </div>

      {/* Daily traffic chart */}
      {dailyTraffic.length > 0 && (
        <ChartCard title="Daily Traffic (14 Days)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTraffic}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="views" name="Page Views" stroke="#3b82f6" fill="url(#viewsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#10b981" fill="url(#visitorsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Top pages + Countries */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Top Pages (30 Days)">
          <div className="space-y-1">
            {traffic.topPages.map((p) => (
              <DataRow key={p.path} label={p.path} value={p.views} maxVal={traffic.topPages[0]?.views || 1} />
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Countries">
          <div className="space-y-1">
            {traffic.countries.map((c) => (
              <DataRow key={c.country} label={c.country} value={c.visitors} maxVal={traffic.countries[0]?.visitors || 1} />
            ))}
            {traffic.countries.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No country data yet</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Referrers + Searches */}
      <div className="grid gap-3 lg:grid-cols-2">
        {traffic.referrers.length > 0 && (
          <ChartCard title="Referrers">
            <div className="space-y-1">
              {traffic.referrers.map((r) => (
                <DataRow key={r.referrer} label={r.referrer} value={r.visitors} maxVal={traffic.referrers[0]?.visitors || 1} />
              ))}
            </div>
          </ChartCard>
        )}
        {traffic.recentSearches.length > 0 && (
          <ChartCard title="Recent Searches">
            <div className="space-y-1">
              {traffic.recentSearches.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">{s.query}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{s.pagePath}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0 ml-2">{timeAgo(s.createdAt)}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* AUCTION MARKET SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Gavel} color="text-amber-400" title="Auction Market" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Auctions (History)" value={auctions.total} icon={Gavel} color="text-amber-400" />
        <StatCard label="Active Auctions Now" value={auctions.active} icon={TrendingUp} color="text-emerald-400" />
        <StatCard
          label="Avg Sold Price"
          value={`${formatNum(auctions.avgSoldPrice)} TC`}
          icon={ShoppingCart}
          color="text-sky-400"
        />
        <StatCard
          label="Sell Rate"
          value={`${Math.round(((auctions.statusBreakdown.find(s => s.status === 'sold')?.count || 0) / Math.max(auctions.total, 1)) * 100)}%`}
          icon={TrendingUp}
          color="text-violet-400"
          sub={`${formatNum(auctions.statusBreakdown.find(s => s.status === 'sold')?.count || 0)} sold`}
        />
      </div>

      {/* Auction status pie + Daily new auctions */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Auction Status Breakdown">
          <div className="h-56 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatNum(value)}
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {dailyAuctions.length > 0 && (
          <ChartCard title="New Auctions Per Day (14 Days)">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyAuctions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="New Auctions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
      </div>

      {/* Vocation breakdown + World distribution */}
      <div className="grid gap-3 lg:grid-cols-2">
        {vocationData.length > 0 && (
          <ChartCard title="Auctions by Vocation">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vocationData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#888' }} width={50} />
                  <Tooltip
                    content={<CustomTooltip />}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sold" name="Sold" fill="#10b981" stackId="stack" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="total" name="Total" fill="#3b82f640" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}

        <ChartCard title="Active Auctions by World">
          <div className="space-y-1">
            {auctions.worldDistribution.map((w) => (
              <DataRow key={w.world} label={w.world} value={w.count} maxVal={auctions.worldDistribution[0]?.count || 1} />
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Avg price by vocation */}
      {auctions.vocationBreakdown.length > 0 && (
        <ChartCard title="Average Sold Price by Vocation (TC)">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vocationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgPrice" name="Avg Price (TC)" radius={[4, 4, 0, 0]}>
                  {vocationData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* USERS & COMMUNITY SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Users} color="text-blue-400" title="Users & Community" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total Users" value={users.total} icon={Users} color="text-blue-400" />
        <StatCard label="Premium Users" value={users.premium} icon={Users} color="text-amber-400" />
        <StatCard label="Pending Requests" value={users.pendingRequests} icon={Users} color={users.pendingRequests > 0 ? 'text-red-400' : 'text-green-400'} />
        <StatCard label="Feature Requests" value={community.featureRequests} icon={MessageCircle} color="text-violet-400" />
        <StatCard label="Feedback" value={community.feedback} icon={MessageCircle} color="text-pink-400" />
        <StatCard label="Active Listings" value={community.activeListings} icon={ShoppingCart} color="text-teal-400" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* GAME DATA SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Shield} color="text-red-400" title="Game Data" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Bans" value={gameData.totalBans} icon={Shield} color="text-red-400" />
        <StatCard label="Active Bans" value={gameData.activeBans} icon={Shield} color="text-orange-400" />
        <StatCard label="Total Transfers" value={gameData.totalTransfers} icon={ArrowRightLeft} color="text-sky-400" />
        <StatCard
          label="Transfer Routes"
          value={gameData.topTransferRoutes.length}
          icon={Globe}
          color="text-violet-400"
        />
      </div>

      {gameData.topTransferRoutes.length > 0 && (
        <ChartCard title="Top Transfer Routes">
          <div className="space-y-1">
            {gameData.topTransferRoutes.map((r, i) => (
              <DataRow
                key={i}
                label={`${r.from} → ${r.to}`}
                value={r.count}
                maxVal={gameData.topTransferRoutes[0]?.count || 1}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[10px] text-muted-foreground">
          Auto-refreshes every 60 seconds &middot; Data is live from the database
        </p>
      </div>
    </div>
  );
}
