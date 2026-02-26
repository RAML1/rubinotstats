'use client';

import { useState, useMemo } from 'react';
import { Search, Ban, Clock, AlertTriangle, ChevronLeft, ChevronRight, Shield, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

// Rose-based gradient scale for ban reasons (single-hue, varying intensity)
const REASON_COLORS = [
  '#FB7185', '#F472B6', '#E879A8', '#D97098', '#C96B8A', '#B9617C', '#A85870',
];

const PIE_COLORS = ['#FB7185', '#00D4FF'];

function GlassTooltip({ active, payload, label, suffix = '' }: any) {
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
      <p className="font-medium text-[11px] text-white/90 mb-0.5">{label || payload[0]?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ color: p.color || p.fill || '#FB7185' }}>{p.name || p.dataKey}</span>
          {': '}{p.value}{suffix}
        </p>
      ))}
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
        {/* Bans by Reason — horizontal bar with rose gradient scale */}
        <div className="overflow-hidden rounded-2xl" style={{ background: 'rgba(21,28,42,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold">Bans by Rule</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={insights.byReason}
                layout="vertical"
                margin={{ left: 0, right: 8, top: 0, bottom: 0 }}
              >
                <defs>
                  {insights.byReason.map((_, i) => (
                    <linearGradient key={`rg-${i}`} id={`reasonGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={REASON_COLORS[i % REASON_COLORS.length]} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={REASON_COLORS[i % REASON_COLORS.length]} stopOpacity={0.85} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={70}
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<GlassTooltip suffix=" bans" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {insights.byReason.map((_, i) => (
                    <Cell key={i} fill={`url(#reasonGrad-${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Permanent vs Temporary — donut with glow */}
        <div className="overflow-hidden rounded-2xl" style={{ background: 'rgba(21,28,42,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold">Ban Duration</h3>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <defs>
                    <filter id="pieGlow" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <linearGradient id="permGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FB7185" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#E11D48" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0891B2" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={32}
                    outerRadius={54}
                    paddingAngle={4}
                    strokeWidth={0}
                    style={{ filter: 'url(#pieGlow)' }}
                  >
                    <Cell fill="url(#permGrad)" />
                    <Cell fill="url(#tempGrad)" />
                  </Pie>
                  <Tooltip content={<GlassTooltip suffix=" bans" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: 'linear-gradient(135deg, #FB7185, #E11D48)' }} />
                  <div>
                    <p className="text-lg font-bold">{insights.permanent}</p>
                    <p className="text-xs text-muted-foreground">Permanent</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: 'linear-gradient(135deg, #00D4FF, #0891B2)' }} />
                  <div>
                    <p className="text-lg font-bold">{insights.temporary}</p>
                    <p className="text-xs text-muted-foreground">Temporary</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bans Over Time — gradient bars */}
        <div className="overflow-hidden rounded-2xl" style={{ background: 'rgba(21,28,42,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold">Bans Over Time</h3>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={insights.byDate.map(d => ({ ...d, label: formatShortDate(d.date) }))}
                margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bansTimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB7185" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#FB7185" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip content={<GlassTooltip suffix=" bans" />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="count" fill="url(#bansTimeGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-2"
            style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185' }}
          >
            <Ban className="h-4 w-4" />
            <span className="text-sm font-bold">{total.toLocaleString()} active bans</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(236,240,247,0.38)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or reason..."
            className="h-10 w-full rounded-lg pl-10 pr-3 text-sm font-medium outline-none transition-all"
            style={{
              background: 'rgba(21,28,42,0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#ecf0f7',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </form>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: 'rgba(21,28,42,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(236,240,247,0.38)' }}>Player</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(236,240,247,0.38)' }}>Reason</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(236,240,247,0.38)' }}>Banned</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(236,240,247,0.38)' }}>Expires</th>
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
                    className="transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245,158,11,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3 font-medium">{ban.playerName}</td>
                    <td className={`px-4 py-3 ${getReasonColor(ban.reason)}`}>
                      {ban.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(ban.bannedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ban.isPermanent ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.2)', color: '#fb7185' }}>
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
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-medium" style={{ color: 'rgba(236,240,247,0.38)' }}>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page <= 1 || loading}
                className="rounded-lg p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(26,34,54,0.7)' }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="rounded-lg p-1.5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(26,34,54,0.7)' }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
