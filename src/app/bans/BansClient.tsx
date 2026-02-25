'use client';

import { useState, useMemo } from 'react';
import { Search, Ban, Clock, AlertTriangle, ChevronLeft, ChevronRight, Shield, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface BanEntry {
  id: number;
  playerName: string;
  world: string | null;
  reason: string | null;
  bannedAt: string | null;
  expiresAt: string | null;
  isPermanent: boolean;
}

interface BanInsights {
  byReason: { reason: string; count: number }[];
  permanent: number;
  temporary: number;
  byDate: { date: string; count: number }[];
}

interface BansClientProps {
  initialBans: BanEntry[];
  initialTotal: number;
  insights: BanInsights;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getReasonColor(reason: string | null): string {
  if (!reason) return 'text-muted-foreground';
  const r = reason.toLowerCase();
  if (r.includes('cheat') || r.includes('bot')) return 'text-red-400';
  if (r.includes('name')) return 'text-yellow-400';
  if (r.includes('abuse') || r.includes('bug')) return 'text-orange-400';
  return 'text-muted-foreground';
}

const REASON_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
];

const PIE_COLORS = ['#ef4444', '#3b82f6'];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="font-medium text-foreground">{label || payload[0]?.name}</p>
      <p className="text-muted-foreground">{payload[0]?.value} bans</p>
    </div>
  );
}

export function BansClient({ initialBans, initialTotal, insights }: BansClientProps) {
  const [bans, setBans] = useState<BanEntry[]>(initialBans);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(total / 50);

  const filteredBans = useMemo(() => {
    if (!search.trim() && page === 1) return bans;
    if (page === 1 && search.trim()) {
      return bans.filter(b =>
        b.playerName.toLowerCase().includes(search.toLowerCase()) ||
        (b.reason && b.reason.toLowerCase().includes(search.toLowerCase()))
      );
    }
    return bans;
  }, [bans, search, page]);

  async function fetchPage(newPage: number, searchTerm?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(newPage),
        limit: '50',
      });
      if (searchTerm ?? search) params.set('search', searchTerm ?? search);

      const res = await fetch(`/api/bans?${params}`);
      const json = await res.json();
      if (json.success) {
        setBans(json.data);
        setTotal(json.pagination.total);
        setPage(newPage);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPage(1, search);
  }

  const pieData = [
    { name: 'Permanent', value: insights.permanent },
    { name: 'Temporary', value: insights.temporary },
  ];

  return (
    <div className="space-y-6">
      {/* Insights Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bans by Reason */}
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold">Bans by Rule</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={insights.byReason}
                layout="vertical"
                margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={70}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {insights.byReason.map((_, i) => (
                    <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Permanent vs Temporary */}
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold">Ban Duration</h3>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div>
                    <p className="text-lg font-bold">{insights.permanent}</p>
                    <p className="text-xs text-muted-foreground">Permanent</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500/80" />
                  <div>
                    <p className="text-lg font-bold">{insights.temporary}</p>
                    <p className="text-xs text-muted-foreground">Temporary</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bans Over Time */}
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold">Bans Over Time</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={insights.byDate.map(d => ({ ...d, label: formatShortDate(d.date) }))}
                margin={{ left: -10, right: 8, top: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="count" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stats + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5">
            <Ban className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">{total.toLocaleString()} active bans</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or reason..."
            className="h-9 w-full rounded-lg border border-border/50 bg-card/50 pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </form>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Player</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Banned</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-50' : ''}>
                {filteredBans.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      {search ? 'No bans match your search' : 'No ban data available yet — run the scraper first'}
                    </td>
                  </tr>
                ) : (
                  filteredBans.map((ban) => (
                    <tr
                      key={ban.id}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium">{ban.playerName}</td>
                      <td className={`px-4 py-2.5 ${getReasonColor(ban.reason)}`}>
                        {ban.reason || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(ban.bannedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {ban.isPermanent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Permanent
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{formatDate(ban.expiresAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => fetchPage(page - 1)}
                  disabled={page <= 1 || loading}
                  className="rounded-md p-1.5 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchPage(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="rounded-md p-1.5 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
