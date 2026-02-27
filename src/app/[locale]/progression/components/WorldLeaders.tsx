'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, TrendingUp, Crown, ChevronUp, Flame, Swords, Shield, Sparkles, Target } from 'lucide-react';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

interface WorldLeader {
  world: string;
  character_name: string;
  vocation: string;
  current_level: number;
  start_level: number;
  exp_gained: number;
  levels_gained: number;
}

interface WorldLeadersProps {
  onSelectCharacter: (name: string) => void;
}

function getVocationIcon(vocation: string) {
  if (vocation.includes('Knight')) return Swords;
  if (vocation.includes('Paladin')) return Target;
  if (vocation.includes('Druid')) return Shield;
  if (vocation.includes('Sorcerer')) return Sparkles;
  return Globe;
}

const PODIUM_CONFIG = [
  { position: 1, order: 'order-2', height: 'h-32', ring: 'ring-amber-400', gradient: 'from-amber-500/20 to-amber-500/5', crownColor: 'text-amber-400', medalBg: 'bg-amber-400', label: '1st' },
  { position: 2, order: 'order-1', height: 'h-24', ring: 'ring-slate-300', gradient: 'from-slate-400/15 to-slate-400/5', crownColor: 'text-slate-300', medalBg: 'bg-slate-300', label: '2nd' },
  { position: 3, order: 'order-3', height: 'h-20', ring: 'ring-amber-700', gradient: 'from-amber-700/15 to-amber-700/5', crownColor: 'text-amber-700', medalBg: 'bg-amber-700', label: '3rd' },
];

function PodiumCard({ leader, config, onSelect }: { leader: WorldLeader; config: typeof PODIUM_CONFIG[0]; onSelect: () => void }) {
  const VocIcon = getVocationIcon(leader.vocation);
  const isFirst = config.position === 1;

  return (
    <div className={`${config.order} flex flex-col items-center`}>
      {/* Character info above podium */}
      <button
        onClick={onSelect}
        className="group flex flex-col items-center mb-3 cursor-pointer"
      >
        {/* Crown for #1 */}
        {isFirst && <Crown size={24} className="text-amber-400 mb-1 animate-pulse" />}

        {/* Avatar */}
        <div
          className={`relative flex items-center justify-center rounded-full ring-2 ${config.ring} transition-transform group-hover:scale-110 ${isFirst ? 'h-16 w-16 text-xl' : 'h-12 w-12 text-base'}`}
          style={{ backgroundColor: getVocationColor(leader.vocation) }}
        >
          <span className="font-bold text-white">{leader.character_name[0].toUpperCase()}</span>
          {/* Medal badge */}
          <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${config.medalBg} text-[10px] font-bold text-background`}>
            {config.position}
          </span>
        </div>

        {/* Name */}
        <p className={`mt-2 font-bold leading-tight text-center group-hover:text-primary transition-colors ${isFirst ? 'text-sm' : 'text-xs'}`}>
          {leader.character_name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <VocIcon size={10} style={{ color: getVocationColor(leader.vocation) }} />
          <span className="text-[10px] text-muted-foreground">{leader.vocation}</span>
        </div>
      </button>

      {/* Podium block */}
      <div className={`w-full ${config.height} rounded-t-xl bg-gradient-to-b ${config.gradient} border border-border/30 border-b-0 flex flex-col items-center justify-start pt-3 backdrop-blur`}>
        <div className="flex items-center gap-1">
          <Globe size={10} className="text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">{leader.world}</span>
        </div>
        <p className="text-lg font-bold text-emerald-400 mt-1">{formatNumber(leader.exp_gained)}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
          <span>Lvl {leader.current_level}</span>
          <span className="text-emerald-400/70">+{leader.levels_gained} lvls</span>
        </div>
      </div>
    </div>
  );
}

function WorldRow({ leader, rank, onSelect }: { leader: WorldLeader; rank: number; onSelect: () => void }) {
  const VocIcon = getVocationIcon(leader.vocation);
  // Calculate a relative bar width — normalize based on the leader's exp (first item is max)
  return (
    <button
      onClick={onSelect}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-card/80 w-full text-left"
    >
      {/* Rank */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-xs font-bold text-muted-foreground">
        {rank}
      </span>

      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold transition-transform group-hover:scale-110"
        style={{ backgroundColor: getVocationColor(leader.vocation) }}
      >
        {leader.character_name[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{leader.character_name}</p>
          <div className="flex items-center gap-0.5">
            <VocIcon size={10} style={{ color: getVocationColor(leader.vocation) }} />
            <span className="text-[10px] text-muted-foreground hidden sm:inline">{leader.vocation}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe size={10} />
          <span>{leader.world}</span>
          <span className="text-foreground/40">·</span>
          <span>Lvl {leader.current_level}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-emerald-400">{formatNumber(leader.exp_gained)}</p>
        <p className="text-[10px] text-muted-foreground">
          <ChevronUp size={10} className="inline text-emerald-400/70" />
          {leader.levels_gained} lvls
        </p>
      </div>
    </button>
  );
}

export default function WorldLeaders({ onSelectCharacter }: WorldLeadersProps) {
  const [leaders, setLeaders] = useState<WorldLeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const res = await fetch('/api/progression?mode=worldLeaders');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setLeaders(json.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch world leaders:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaders();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex justify-center gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-24 w-28 rounded-t-xl" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (leaders.length === 0) return null;

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-1">
        <div className="flex items-center gap-2">
          <Flame size={22} className="text-amber-400" />
          <h2 className="text-2xl font-bold">EXP Leaderboard</h2>
          <Flame size={22} className="text-amber-400" />
        </div>
        <p className="text-sm text-muted-foreground">Top EXP gainer per world · Last 30 days</p>
      </div>

      {/* Podium — Top 3 */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto items-end">
          {top3.map((leader, idx) => (
            <PodiumCard
              key={leader.world}
              leader={leader}
              config={PODIUM_CONFIG[idx]}
              onSelect={() => onSelectCharacter(leader.character_name)}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 px-2">
        <div className="h-px flex-1 bg-border/50" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All Worlds</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* Remaining Worlds — compact list */}
      <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur divide-y divide-border/20">
        {rest.map((leader, idx) => (
          <WorldRow
            key={leader.world}
            leader={leader}
            rank={idx + 4}
            onSelect={() => onSelectCharacter(leader.character_name)}
          />
        ))}
      </div>
    </div>
  );
}
