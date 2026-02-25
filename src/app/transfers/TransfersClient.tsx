'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowRightLeft, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface TransferEntry {
  id: number;
  playerName: string;
  fromWorld: string;
  toWorld: string;
  level: number | null;
  vocation: string | null;
  transferDate: string | null;
}

interface TransfersClientProps {
  initialTransfers: TransferEntry[];
  initialTotal: number;
  worlds: string[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TransfersClient({ initialTransfers, initialTotal, worlds }: TransfersClientProps) {
  const [transfers, setTransfers] = useState<TransferEntry[]>(initialTransfers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [fromWorld, setFromWorld] = useState('');
  const [toWorld, setToWorld] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(total / 50);

  // Client-side filtering for page 1 with no world filters
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
    <div className="space-y-4">
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
