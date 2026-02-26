'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowRightLeft, ChevronLeft, ChevronRight, Globe, TrendingUp, Route, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TransferEntry {
  id: number;
  playerName: string;
  fromWorld: string;
  toWorld: string;
  level: number | null;
  vocation: string | null;
  transferDate: string | null;
}

interface TransferInsights {
  worldFlow: { world: string; arrivals: number; departures: number; net: number }[];
  topRoutes: { route: string; count: number }[];
  levelDistribution: { range: string; count: number }[];
}

interface TransfersClientProps {
  initialTransfers: TransferEntry[];
  initialTotal: number;
  worlds: string[];
  insights: TransferInsights;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LEVEL_GRADIENT_MAP: Record<string, { color: string; id: string }> = {
  '1-99':    { color: '#00D4FF', id: 'lvlGrad1' },
  '100-499': { color: '#34D399', id: 'lvlGrad2' },
  '500-999': { color: '#FFBE0B', id: 'lvlGrad3' },
  '1000+':   { color: '#FB7185', id: 'lvlGrad4' },
};

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: 'rgba(15, 15, 26, 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      <p className="font-medium text-[11px] text-white/90 mb-0.5">{label || payload[0]?.payload?.route || payload[0]?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ color: p.color || p.fill }}>{p.name || p.dataKey}:</span> {p.value}
        </p>
      ))}
    </div>
  );
}

function FlowLegend() {
  return (
    <div className="flex items-center justify-center gap-4 mt-1">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-sm" style={{ background: 'linear-gradient(180deg, #2DD4BF, rgba(45,212,191,0.3))' }} />
        <span className="text-[10px] text-muted-foreground">Arrivals</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-sm" style={{ background: 'linear-gradient(180deg, #FB7185, rgba(251,113,133,0.3))' }} />
        <span className="text-[10px] text-muted-foreground">Departures</span>
      </div>
    </div>
  );
}

export function TransfersClient({ initialTransfers, initialTotal, worlds, insights }: TransfersClientProps) {
  const [transfers, setTransfers] = useState<TransferEntry[]>(initialTransfers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [fromWorld, setFromWorld] = useState('');
  const [toWorld, setToWorld] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(total / 50);

  const filteredTransfers = useMemo(() => {
    if (page === 1 && !fromWorld && !toWorld && search.trim()) {
      return transfers.filter(t =>
        t.playerName.toLowerCase().includes(search.toLowerCase())
      );
    }
    return transfers;
  }, [transfers, search, page, fromWorld, toWorld]);

  async function fetchPage(newPage: number, opts?: { search?: string; from?: string; to?: string }) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(newPage),
        limit: '50',
      });
      const s = opts?.search ?? search;
      const f = opts?.from ?? fromWorld;
      const t = opts?.to ?? toWorld;
      if (s) params.set('search', s);
      if (f) params.set('fromWorld', f);
      if (t) params.set('toWorld', t);

      const res = await fetch(`/api/transfers?${params}`);
      const json = await res.json();
      if (json.success) {
        setTransfers(json.data);
        setTotal(json.pagination.total);
        setPage(newPage);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPage(1);
  }

  function handleWorldFilter(type: 'from' | 'to', value: string) {
    if (type === 'from') {
      setFromWorld(value);
      fetchPage(1, { from: value });
    } else {
      setToWorld(value);
      fetchPage(1, { to: value });
    }
  }

  return (
    <div className="space-y-6">
      {/* Insights Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* World Net Flow — gradient grouped bars */}
        <Card className="border-border/50 bg-card/50 overflow-hidden md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-teal-400" />
              <h3 className="text-sm font-semibold">World Population Flow</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={insights.worldFlow}
                margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="arrivalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0.15} />
                  </linearGradient>
                  <linearGradient id="departGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB7185" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#FB7185" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="world"
                  tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="arrivals" name="Arrivals" fill="url(#arrivalGrad)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="departures" name="Departures" fill="url(#departGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <FlowLegend />
          </CardContent>
        </Card>

        {/* Level Distribution — gradient bars per level range */}
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Transfer Levels</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={insights.levelDistribution}
                margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
              >
                <defs>
                  {Object.entries(LEVEL_GRADIENT_MAP).map(([, { color, id }]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.15} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" name="Players" radius={[6, 6, 0, 0]}>
                  {insights.levelDistribution.map((entry) => {
                    const cfg = LEVEL_GRADIENT_MAP[entry.range];
                    return <Cell key={entry.range} fill={cfg ? `url(#${cfg.id})` : '#6b7280'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Routes */}
      {insights.topRoutes.length > 0 && (
        <Card className="border-border/50 bg-card/50 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Route className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-semibold">Most Popular Routes</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {insights.topRoutes.map((r) => (
                <div
                  key={r.route}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/20 border border-border/30 px-3 py-2"
                >
                  <span className="text-xs font-medium truncate">{r.route}</span>
                  <span className="text-xs font-bold text-primary shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats + Search + Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5">
              <ArrowRightLeft className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">{total.toLocaleString()} transfers</span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search player..."
              className="h-9 w-full rounded-lg border border-border/50 bg-card/50 pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </form>
        </div>

        {/* World filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={fromWorld}
              onChange={(e) => handleWorldFilter('from', e.target.value)}
              className="h-8 rounded-md border border-border/50 bg-card/50 px-2 text-xs outline-none focus:border-primary/50"
            >
              <option value="">From: All Worlds</option>
              {worlds.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={toWorld}
              onChange={(e) => handleWorldFilter('to', e.target.value)}
              className="h-8 rounded-md border border-border/50 bg-card/50 px-2 text-xs outline-none focus:border-primary/50"
            >
              <option value="">To: All Worlds</option>
              {worlds.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          {(fromWorld || toWorld) && (
            <button
              onClick={() => {
                setFromWorld('');
                setToWorld('');
                fetchPage(1, { from: '', to: '' });
              }}
              className="h-8 rounded-md border border-border/50 bg-card/50 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Player</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Level</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">From</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-8"></th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">To</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-50' : ''}>
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      {search || fromWorld || toWorld
                        ? 'No transfers match your filters'
                        : 'No transfer data available yet — run the scraper first'}
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium">{t.playerName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {t.level ?? '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
                          {t.fromWorld}
                        </span>
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-300">
                          {t.toWorld}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDate(t.transferDate)}
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
