'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Swords, Skull, Users, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface PvpKill {
  id: number;
  killerName: string;
  killerLevel: number | null;
  victimName: string;
  victimLevel: number | null;
  mostDamageBy: string | null;
  mostDamageIsPlayer: boolean;
  world: string;
  killedAt: string;
}

interface PvpStats {
  total: number;
  uniqueKillers: number;
  uniqueVictims: number;
  mostActiveWorld: string;
}

interface PvpInsights {
  topKillers: { name: string; count: number }[];
  topVictims: { name: string; count: number }[];
  byWorld: { world: string; count: number }[];
  byDate: { date: string; count: number }[];
}

interface PvpClientProps {
  initialKills: PvpKill[];
  stats: PvpStats;
  insights: PvpInsights;
}

const ITEMS_PER_PAGE = 25;

const glassmorphicCard = {
  backgroundColor: 'rgba(21, 28, 42, 0.6)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '16px',
};

const tooltipStyle = {
  backgroundColor: 'rgba(15, 15, 26, 0.9)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function GlassmorphicTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...tooltipStyle, padding: '10px 14px' }}>
      <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color || '#ef4444' }}>
          {p.value} {p.name || 'kills'}
        </p>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function PvpClient({ initialKills, stats, insights }: PvpClientProps) {
  const t = useTranslations('pvp');
  const [search, setSearch] = useState('');
  const [worldFilter, setWorldFilter] = useState('');
  const [page, setPage] = useState(1);

  const worlds = useMemo(() => {
    const set = new Set(initialKills.map(k => k.world));
    return Array.from(set).sort();
  }, [initialKills]);

  const filtered = useMemo(() => {
    let result = initialKills;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        k => k.killerName.toLowerCase().includes(q) || k.victimName.toLowerCase().includes(q)
      );
    }
    if (worldFilter) {
      result = result.filter(k => k.world === worldFilter);
    }
    return result;
  }, [initialKills, search, worldFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Empty state
  if (initialKills.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center" style={glassmorphicCard}>
        <Swords className="h-16 w-16 mx-auto mb-4" style={{ color: 'rgba(239,68,68,0.4)' }} />
        <h3 className="text-lg font-semibold mb-1">{t('noKills')}</h3>
        <p className="text-sm text-muted-foreground">{t('noKillsDescription')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('totalKills'), value: stats.total, icon: Swords, color: '#ef4444' },
          { label: t('uniqueKillers'), value: stats.uniqueKillers, icon: Skull, color: '#f97316' },
          { label: t('uniqueVictims'), value: stats.uniqueVictims, icon: Users, color: '#a855f7' },
          { label: t('mostActiveWorld'), value: stats.mostActiveWorld, icon: Globe, color: '#3b82f6' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4" style={glassmorphicCard}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4" style={{ color }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {label}
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Killers */}
        <div className="rounded-2xl p-5" style={glassmorphicCard}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {t('topKillers')}
          </h3>
          {insights.topKillers.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={insights.topKillers} layout="vertical" margin={{ left: 0, right: 16 }}>
                <defs>
                  <linearGradient id="killGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 6" />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassmorphicTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name={t('kills')} fill="url(#killGrad)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          )}
        </div>

        {/* Kills Over Time */}
        <div className="rounded-2xl p-5" style={glassmorphicCard}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {t('killsOverTime')}
          </h3>
          {insights.byDate.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={insights.byDate} margin={{ left: 0, right: 16, top: 8 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 6" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassmorphicTooltip />} cursor={{ stroke: 'rgba(239,68,68,0.3)' }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name={t('kills')}
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#areaGrad)"
                  filter="url(#glow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Kills by World */}
      {insights.byWorld.length > 0 && (
        <div className="rounded-2xl p-5" style={glassmorphicCard}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {t('killsByWorld')}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={insights.byWorld} margin={{ left: 0, right: 16 }}>
              <defs>
                <linearGradient id="worldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 6" />
              <XAxis dataKey="world" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<GlassmorphicTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name={t('kills')} fill="url(#worldGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Kills Table */}
      <div className="rounded-2xl p-5" style={glassmorphicCard}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {t('recentKills')}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('searchPlaceholder')}
                className="h-8 w-48 rounded-lg pl-8 pr-3 text-xs bg-transparent outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              />
            </div>
            {/* World filter */}
            <select
              value={worldFilter}
              onChange={(e) => { setWorldFilter(e.target.value); setPage(1); }}
              className="h-8 rounded-lg px-2.5 text-xs bg-transparent outline-none cursor-pointer"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
            >
              <option value="" style={{ backgroundColor: '#0f1420' }}>{t('allWorlds')}</option>
              {worlds.map(w => (
                <option key={w} value={w} style={{ backgroundColor: '#0f1420' }}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left pb-2.5 font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{t('killer')}</th>
                <th className="text-left pb-2.5 font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>Lv</th>
                <th className="text-left pb-2.5 font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{t('victim')}</th>
                <th className="text-left pb-2.5 font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>Lv</th>
                <th className="text-left pb-2.5 font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{t('world')}</th>
                <th className="text-right pb-2.5 font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{t('time')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((k) => (
                <tr
                  key={k.id}
                  className="group"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <td className="py-2.5 pr-3">
                    <a
                      href={`https://rubinot.com.br/?subtopic=characters&name=${encodeURIComponent(k.killerName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                      style={{ color: '#ef4444' }}
                    >{k.killerName}</a>
                  </td>
                  <td className="py-2.5 pr-3 hidden sm:table-cell">
                    <span style={{ color: 'rgba(239,68,68,0.6)' }}>{k.killerLevel ?? '—'}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <a
                      href={`https://rubinot.com.br/?subtopic=characters&name=${encodeURIComponent(k.victimName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                    >{k.victimName}</a>
                  </td>
                  <td className="py-2.5 pr-3 hidden sm:table-cell">
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{k.victimLevel ?? '—'}</span>
                  </td>
                  <td className="py-2.5 pr-3 hidden sm:table-cell">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                      {k.world}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{formatTime(k.killedAt)}</span>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No kills matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {filtered.length} kills
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
