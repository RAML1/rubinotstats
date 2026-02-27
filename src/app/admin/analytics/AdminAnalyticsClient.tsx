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
  Crown,
  Activity,
  Flame,
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
    topSearches: { query: string; count: number }[];
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
    userList: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      premiumTier: string;
      premiumSince: string | null;
      premiumUntil: string | null;
      isAdmin: boolean;
      createdAt: string;
    }[];
    premiumRequests: {
      id: number;
      characterName: string;
      requestedTier: string;
      rcAmount: number | null;
      transactionDate: string | null;
      status: string;
      adminNote: string | null;
      reviewedAt: string | null;
      createdAt: string;
      user: { name: string | null; email: string | null; image: string | null };
    }[];
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

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/current-auctions': 'Current Auctions',
  '/market': 'Item Market',
  '/progression': 'Progression',
  '/calculator': 'Skill Calculator',
  '/bans': 'Bans',
  '/transfers': 'Transfers',
  '/insights': 'Premium Insights',
  '/feature-requests': 'Feature Requests',
  '/premium': 'Premium',
  '/pvp': 'PvP',
  '/auth/signin': 'Sign In',
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
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDay(day: string): string {
  return new Date(day + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(code: string): string {
  try { return countryNames.of(code) || code; } catch { return code; }
}

function pageName(path: string): string {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  // Strip locale prefix like /pt-BR/calculator -> /calculator
  const stripped = path.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');
  if (PAGE_NAMES[stripped]) return PAGE_NAMES[stripped];
  // Fallback: capitalize the last segment
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || 'Home';
  return last.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Reusable Components ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  icon: typeof Eye;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 transition-all hover:border-border">
      <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full ${accent} opacity-[0.07] transition-opacity group-hover:opacity-[0.12]`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent} bg-opacity-10`}
          style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight truncate">{typeof value === 'number' ? formatNum(value) : value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[9px] text-muted-foreground/60">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, accent, title }: { icon: typeof Eye; accent: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-4 pb-1">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}
        style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}>
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
      </div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">{title}</h2>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card p-5 ${className || ''}`}>
      <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

function DataRow({ label, value, maxVal, accent }: { label: string; value: number; maxVal: number; accent?: string }) {
  const pct = Math.max((value / Math.max(maxVal, 1)) * 100, 2);
  return (
    <div className="group relative rounded-lg px-3 py-2 transition-colors hover:bg-accent/30">
      <div
        className={`absolute inset-y-0 left-0 rounded-lg ${accent || 'bg-primary/8'} transition-all`}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-medium truncate mr-2">{label}</span>
        <span className="text-xs font-bold tabular-nums shrink-0">{formatNum(value)}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-md px-3.5 py-2.5 shadow-2xl">
      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <p key={i} className="text-xs font-bold" style={{ color: entry.color }}>
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <Activity className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Analytics</h1>
              <p className="text-[10px] text-muted-foreground">Real-time dashboard &middot; Admin views excluded</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TRAFFIC SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Eye} accent="text-sky-400" title="Traffic" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Visitors Today" value={traffic.overview.visitorsToday} icon={Users} accent="text-emerald-400" />
        <StatCard label="Page Views Today" value={traffic.overview.pageViewsToday} icon={Eye} accent="text-sky-400" />
        <StatCard label="Visitors This Week" value={traffic.overview.visitorsWeek} icon={Users} accent="text-violet-400" />
        <StatCard label="Page Views This Week" value={traffic.overview.pageViewsWeek} icon={Eye} accent="text-orange-400" />
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Visitors This Month" value={traffic.overview.visitorsMonth} icon={Users} accent="text-pink-400" />
        <StatCard label="Page Views This Month" value={traffic.overview.pageViewsMonth} icon={Eye} accent="text-amber-400" />
        <StatCard label="Total Unique Visitors" value={traffic.overview.totalVisitors} icon={Users} accent="text-blue-400" />
        <StatCard label="Total Sessions" value={traffic.overview.totalSessions} icon={BarChart3} accent="text-teal-400" />
      </div>

      {/* Daily traffic chart */}
      {dailyTraffic.length > 0 && (
        <ChartCard title="Daily Traffic — 14 Days">
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} />
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
        <ChartCard title="Top Pages — 30 Days">
          <div className="space-y-1">
            {traffic.topPages.map((p) => (
              <DataRow key={p.path} label={pageName(p.path)} value={p.views} maxVal={traffic.topPages[0]?.views || 1} accent="bg-sky-500/8" />
            ))}
          </div>
        </ChartCard>
        <ChartCard title="Countries">
          <div className="space-y-1">
            {traffic.countries.map((c) => (
              <DataRow key={c.country} label={countryName(c.country)} value={c.visitors} maxVal={traffic.countries[0]?.visitors || 1} accent="bg-emerald-500/8" />
            ))}
            {traffic.countries.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No country data yet</p>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Top Searches + Recent Searches */}
      <div className="grid gap-3 lg:grid-cols-2">
        {traffic.topSearches.length > 0 && (
          <ChartCard title="Top Searches — All Time">
            <div className="space-y-1">
              {traffic.topSearches.map((s) => (
                <DataRow key={s.query} label={s.query} value={s.count} maxVal={traffic.topSearches[0]?.count || 1} accent="bg-amber-500/8" />
              ))}
            </div>
          </ChartCard>
        )}
        {traffic.recentSearches.length > 0 && (
          <ChartCard title="Recent Searches">
            <div className="space-y-0.5">
              {traffic.recentSearches.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-accent/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Search className="h-3.5 w-3.5 text-amber-400/60 shrink-0" />
                    <span className="text-xs font-medium truncate">{s.query}</span>
                    <span className="text-[9px] text-muted-foreground/60 shrink-0 hidden sm:inline">{pageName(s.pagePath)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-2 tabular-nums">{timeAgo(s.createdAt)}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* Referrers */}
      {traffic.referrers.length > 0 && (
        <ChartCard title="Referrers">
          <div className="space-y-1">
            {traffic.referrers.map((r) => (
              <DataRow key={r.referrer} label={r.referrer} value={r.visitors} maxVal={traffic.referrers[0]?.visitors || 1} accent="bg-violet-500/8" />
            ))}
          </div>
        </ChartCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* AUCTION MARKET SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Gavel} accent="text-amber-400" title="Auction Market" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Auctions (History)" value={auctions.total} icon={Gavel} accent="text-amber-400" />
        <StatCard label="Active Auctions Now" value={auctions.active} icon={Flame} accent="text-emerald-400" />
        <StatCard
          label="Avg Sold Price"
          value={`${formatNum(auctions.avgSoldPrice)} TC`}
          icon={ShoppingCart}
          accent="text-sky-400"
        />
        <StatCard
          label="Sell Rate"
          value={`${Math.round(((auctions.statusBreakdown.find(s => s.status === 'sold')?.count || 0) / Math.max(auctions.total, 1)) * 100)}%`}
          icon={TrendingUp}
          accent="text-violet-400"
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
                  contentStyle={{ backgroundColor: 'rgba(15,20,32,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {dailyAuctions.length > 0 && (
          <ChartCard title="New Auctions Per Day — 14 Days">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyAuctions}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="New Auctions" fill="#f59e0b" radius={[6, 6, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#666' }} width={50} />
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
              <DataRow key={w.world} label={w.world} value={w.count} maxVal={auctions.worldDistribution[0]?.count || 1} accent="bg-amber-500/8" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgPrice" name="Avg Price (TC)" radius={[6, 6, 0, 0]}>
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
      <SectionHeader icon={Users} accent="text-blue-400" title="Users & Community" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Users" value={users.total} icon={Users} accent="text-blue-400" />
        <StatCard label="Premium Users" value={users.premium} icon={Crown} accent="text-amber-400" />
        <StatCard label="Pending Requests" value={users.pendingRequests} icon={Users} accent={users.pendingRequests > 0 ? 'text-red-400' : 'text-green-400'} />
        <StatCard label="Feature Requests" value={community.featureRequests} icon={MessageCircle} accent="text-violet-400" />
        <StatCard label="Feedback" value={community.feedback} icon={MessageCircle} accent="text-pink-400" />
        <StatCard label="Active Listings" value={community.activeListings} icon={ShoppingCart} accent="text-teal-400" />
      </div>

      {/* Users Table */}
      {users.userList?.length > 0 && (
        <ChartCard title={`Users — Last ${users.userList.length}`}>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 text-left text-muted-foreground/60">
                  <th className="pb-3 pr-3 pl-2 font-medium">User</th>
                  <th className="pb-3 pr-3 font-medium">Email</th>
                  <th className="pb-3 pr-3 font-medium">Tier</th>
                  <th className="pb-3 pr-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Premium Until</th>
                </tr>
              </thead>
              <tbody>
                {users.userList.map((u) => (
                  <tr key={u.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                    <td className="py-2.5 pr-3 pl-2">
                      <div className="flex items-center gap-2">
                        {u.image ? (
                          <img src={u.image} alt="" className="h-6 w-6 rounded-full" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold">
                            {u.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="font-medium truncate max-w-[120px]">{u.name || '---'}</span>
                        {u.isAdmin && <Shield className="h-3 w-3 text-primary shrink-0" />}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground truncate max-w-[150px]">{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        u.premiumTier === 'legacy' ? 'bg-amber-400/15 text-amber-400'
                        : u.premiumTier === 'subscriber' ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {u.premiumTier !== 'free' && <Crown className="h-2.5 w-2.5" />}
                        {u.premiumTier}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-muted-foreground tabular-nums">
                      {u.premiumUntil ? new Date(u.premiumUntil).toLocaleDateString() : u.premiumTier === 'legacy' ? 'Lifetime' : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Premium Payment Log */}
      {users.premiumRequests?.length > 0 && (
        <ChartCard title={`Premium Payment Log — ${users.premiumRequests.length}`}>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 text-left text-muted-foreground/60">
                  <th className="pb-3 pr-3 pl-2 font-medium">User</th>
                  <th className="pb-3 pr-3 font-medium">Character</th>
                  <th className="pb-3 pr-3 font-medium">Tier</th>
                  <th className="pb-3 pr-3 font-medium">RC</th>
                  <th className="pb-3 pr-3 font-medium">Payment Date</th>
                  <th className="pb-3 pr-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {users.premiumRequests.map((r) => (
                  <tr key={r.id} className={`border-b border-border/20 hover:bg-accent/20 transition-colors ${r.status === 'pending' ? 'bg-amber-400/[0.03]' : ''}`}>
                    <td className="py-2.5 pr-3 pl-2 font-medium truncate max-w-[100px]">
                      {r.user.name || r.user.email || '---'}
                    </td>
                    <td className="py-2.5 pr-3">{r.characterName}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        r.requestedTier === 'legacy' ? 'bg-amber-400/15 text-amber-400' : 'bg-primary/15 text-primary'
                      }`}>
                        <Crown className="h-2.5 w-2.5" />
                        {r.requestedTier}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">{r.rcAmount || '---'}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">
                      {r.transactionDate ? new Date(r.transactionDate).toLocaleDateString() : '---'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        r.status === 'approved' ? 'bg-green-500/15 text-green-500'
                        : r.status === 'rejected' ? 'bg-destructive/15 text-destructive'
                        : 'bg-amber-400/15 text-amber-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground tabular-nums">
                      {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* GAME DATA SECTION */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <SectionHeader icon={Shield} accent="text-red-400" title="Game Data" />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Bans" value={gameData.totalBans} icon={Shield} accent="text-red-400" />
        <StatCard label="Active Bans" value={gameData.activeBans} icon={Shield} accent="text-orange-400" />
        <StatCard label="Total Transfers" value={gameData.totalTransfers} icon={ArrowRightLeft} accent="text-sky-400" />
        <StatCard
          label="Transfer Routes"
          value={gameData.topTransferRoutes.length}
          icon={Globe}
          accent="text-violet-400"
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
                accent="bg-red-500/8"
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-[10px] text-muted-foreground/40">
          Auto-refreshes every 60s &middot; Admin views excluded &middot; Live data
        </p>
      </div>
    </div>
  );
}
