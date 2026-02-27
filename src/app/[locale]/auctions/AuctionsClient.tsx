'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X,
  Swords,
  Shield,
  Crosshair,
  Wand2,
  ExternalLink,
  Info,
  Sparkles,
  Trophy,
  Crown,
  Heart,
  Fish,
  Footprints,
  ScrollText,
  Skull,
  Gem,
  Package,
  Users,
  Target,
  Coins,
  Star,
  CircleDot,
  Zap,
  Flame,
  Hand,
  Check,
  Clock,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { formatNumber, getVocationColor, formatTimeRemaining } from '@/lib/utils/formatters';

type SerializedAuction = {
  id: number;
  externalId: string | null;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  auctionStatus: string | null;
  soldPrice: number | null;
  coinsPerLevel: number | null;
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;
  hitPoints: number | null;
  mana: number | null;
  capacity: number | null;
  speed: number | null;
  experience: string | null;
  creationDate: string | null;
  achievementPoints: number | null;
  mountsCount: number | null;
  outfitsCount: number | null;
  titlesCount: number | null;
  linkedTasks: number | null;
  dailyRewardStreak: number | null;
  charmExpansion: boolean | null;
  charmPoints: number | null;
  unusedCharmPoints: number | null;
  spentCharmPoints: number | null;
  preySlots: number | null;
  preyWildcards: number | null;
  huntingTaskPoints: number | null;
  hirelings: number | null;
  hirelingJobs: number | null;
  storeItemsCount: number | null;
  bossPoints: number | null;
  blessingsCount: number | null;
  exaltedDust: string | null;
  gold: number | null;
  bestiary: number | null;
  hasLootPouch: boolean | null;
  url: string | null;
  primalOrdealAvailable: boolean | null;
  soulWarAvailable: boolean | null;
  sanguineBloodAvailable: boolean | null;
  createdAt: string;
  updatedAt: string;
};

interface AuctionsClientProps {
  initialAuctions: SerializedAuction[];
  worlds: string[];
  vocations: string[];
  initialSearch?: string;
}

type SortField = 'soldPrice' | 'level' | 'coinsPerLevel' | 'magicLevel' | 'charmPoints';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 24;

// Currency conversion rates (base: 1 TC = R$ 11 BRL)
const BRL_PER_COIN = 11;
const CURRENCY_RATES: Record<string, { symbol: string; rate: number; code: string }> = {
  BRL: { symbol: 'R$', rate: 1, code: 'BRL' },
  USD: { symbol: '$', rate: 0.192, code: 'USD' },
  MXN: { symbol: '$', rate: 3.31, code: 'MXN' },
  VES: { symbol: 'Bs.', rate: 56.25, code: 'VES' },
};

function convertPrice(coins: number): Record<string, number> {
  const brlValue = coins * BRL_PER_COIN;
  const conversions: Record<string, number> = {};
  for (const [key, { rate }] of Object.entries(CURRENCY_RATES)) {
    conversions[key] = brlValue * rate;
  }
  return conversions;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

// Skill configuration — uniform warm tan like Exevo Pan
const SKILL_BOX_BG = 'bg-amber-800/30';
const SKILL_BOX_COLOR = '#d5a76b';

const SKILL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string; maxRef: number }> = {
  magicLevel: { label: 'Magic', icon: Wand2, color: '#c084fc', bgColor: SKILL_BOX_BG, maxRef: 130 },
  sword: { label: 'Sword', icon: Swords, color: '#f87171', bgColor: SKILL_BOX_BG, maxRef: 130 },
  axe: { label: 'Axe', icon: Swords, color: '#fb923c', bgColor: SKILL_BOX_BG, maxRef: 130 },
  club: { label: 'Club', icon: Swords, color: '#f87171', bgColor: SKILL_BOX_BG, maxRef: 130 },
  distance: { label: 'Distance', icon: Crosshair, color: '#fbbf24', bgColor: SKILL_BOX_BG, maxRef: 130 },
  shielding: { label: 'Shielding', icon: Shield, color: '#60a5fa', bgColor: SKILL_BOX_BG, maxRef: 130 },
  fist: { label: 'Fist', icon: Hand, color: '#a78bfa', bgColor: SKILL_BOX_BG, maxRef: 130 },
  fishing: { label: 'Fishing', icon: Fish, color: '#94a3b8', bgColor: SKILL_BOX_BG, maxRef: 130 },
};

function getAllSkills(auction: SerializedAuction): Array<{ key: string; value: number }> {
  const voc = auction.vocation || '';
  const skills: Array<{ key: string; value: number }> = [];

  if (voc.includes('Sorcerer') || voc.includes('Druid')) {
    if (auction.magicLevel) skills.push({ key: 'magicLevel', value: auction.magicLevel });
    if (auction.shielding) skills.push({ key: 'shielding', value: auction.shielding });
    if (auction.distance) skills.push({ key: 'distance', value: auction.distance });
    if (auction.fist) skills.push({ key: 'fist', value: auction.fist });
    if (auction.sword) skills.push({ key: 'sword', value: auction.sword });
    if (auction.axe) skills.push({ key: 'axe', value: auction.axe });
    if (auction.club) skills.push({ key: 'club', value: auction.club });
    if (auction.fishing) skills.push({ key: 'fishing', value: auction.fishing });
  } else if (voc.includes('Paladin')) {
    if (auction.distance) skills.push({ key: 'distance', value: auction.distance });
    if (auction.magicLevel) skills.push({ key: 'magicLevel', value: auction.magicLevel });
    if (auction.shielding) skills.push({ key: 'shielding', value: auction.shielding });
    if (auction.fist) skills.push({ key: 'fist', value: auction.fist });
    if (auction.sword) skills.push({ key: 'sword', value: auction.sword });
    if (auction.axe) skills.push({ key: 'axe', value: auction.axe });
    if (auction.club) skills.push({ key: 'club', value: auction.club });
    if (auction.fishing) skills.push({ key: 'fishing', value: auction.fishing });
  } else if (voc.includes('Knight')) {
    const melee = [
      { key: 'sword', value: auction.sword || 0 },
      { key: 'axe', value: auction.axe || 0 },
      { key: 'club', value: auction.club || 0 },
    ].sort((a, b) => b.value - a.value);
    melee.filter((s) => s.value > 0).forEach((s) => skills.push(s));
    if (auction.shielding) skills.push({ key: 'shielding', value: auction.shielding });
    if (auction.magicLevel) skills.push({ key: 'magicLevel', value: auction.magicLevel });
    if (auction.distance) skills.push({ key: 'distance', value: auction.distance });
    if (auction.fist) skills.push({ key: 'fist', value: auction.fist });
    if (auction.fishing) skills.push({ key: 'fishing', value: auction.fishing });
  } else {
    if (auction.magicLevel) skills.push({ key: 'magicLevel', value: auction.magicLevel });
    if (auction.shielding) skills.push({ key: 'shielding', value: auction.shielding });
    if (auction.distance) skills.push({ key: 'distance', value: auction.distance });
    if (auction.fist) skills.push({ key: 'fist', value: auction.fist });
    if (auction.sword) skills.push({ key: 'sword', value: auction.sword });
    if (auction.axe) skills.push({ key: 'axe', value: auction.axe });
    if (auction.club) skills.push({ key: 'club', value: auction.club });
    if (auction.fishing) skills.push({ key: 'fishing', value: auction.fishing });
  }

  return skills;
}

function getTopSkills(auction: SerializedAuction): Array<{ key: string; value: number }> {
  return getAllSkills(auction).slice(0, 3);
}

// Thresholds for skill highlighting
const SKILL_BASE = 11; // default untrained skill
const SKILL_TRAINED_THRESHOLD = 20; // clearly trained

function SkillBox({ skillKey, value, isTrained }: { skillKey: string; value: number; isTrained: boolean }) {
  const config = SKILL_CONFIG[skillKey];
  if (!config) return null;

  // Trained skills get a brighter green-tinted box, untrained stay muted brown
  const boxStyle = isTrained
    ? { backgroundColor: '#2a5a2a', color: '#4ade80', border: '1px solid #3a7a3a' }
    : { backgroundColor: '#604a1e', color: '#d4a84a', border: '1px solid #7a5f2a' };

  return (
    <div className="flex items-center gap-1">
      <div
        className="flex h-[22px] w-7 items-center justify-center rounded text-[10px] font-bold tabular-nums"
        style={boxStyle}
      >
        {value}
      </div>
      <span className="text-[10px]" style={{ color: isTrained ? '#b0b0c0' : '#8a8698' }}>{config.label}</span>
    </div>
  );
}

function SkillBar({ skillKey, value, compact }: { skillKey: string; value: number; compact?: boolean }) {
  const config = SKILL_CONFIG[skillKey];
  if (!config) return null;
  const Icon = config.icon;
  const fillPercent = Math.min(100, (value / config.maxRef) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 w-[52px] shrink-0">
          <Icon className="h-3 w-3" style={{ color: config.color }} />
          <span className="text-[10px] text-muted-foreground uppercase">{config.label}</span>
        </div>
        <div className="flex-1 h-[6px] bg-secondary/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${fillPercent}%`, backgroundColor: config.color, opacity: 0.7 }}
          />
        </div>
        <span className="text-[11px] font-bold tabular-nums w-[28px] text-right" style={{ color: config.color }}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 w-[52px] shrink-0">
        <Icon className="h-3 w-3" style={{ color: config.color }} />
        <span className="text-[10px] text-muted-foreground">{config.label}</span>
      </div>
      <div className="flex-1 h-[14px] bg-secondary/40 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: config.color,
            opacity: 0.7,
          }}
        />
      </div>
      <span
        className="text-xs font-bold tabular-nums w-[32px] text-right"
        style={{ color: config.color }}
      >
        {value}
      </span>
    </div>
  );
}

function getCharacterTags(auction: SerializedAuction): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = [];
  if ((auction.charmPoints || 0) >= 2000) tags.push({ label: 'Many charms', color: '#10b981' });
  if ((auction.mountsCount || 0) >= 15) tags.push({ label: 'Many mounts', color: '#06b6d4' });
  if ((auction.outfitsCount || 0) >= 15) tags.push({ label: 'Many outfits', color: '#a78bfa' });
  if (auction.soulWarAvailable) tags.push({ label: 'Soul War available', color: '#f59e0b' });
  if (auction.primalOrdealAvailable) tags.push({ label: 'Primal Ordeal available', color: '#f97316' });
  if (auction.sanguineBloodAvailable) tags.push({ label: 'Sanguine available', color: '#ef4444' });
  // Charm Expansion and Prey Slot shown as checkmarks in stats section, not as tags
  if (auction.hasLootPouch) tags.push({ label: 'Loot Pouch', color: '#f59e0b' });
  if ((auction.storeItemsCount || 0) >= 10) tags.push({ label: 'Store cosmetics', color: '#ec4899' });
  return tags;
}

function PriceTooltip({ coins }: { coins: number }) {
  const [show, setShow] = useState(false);
  const conversions = convertPrice(coins);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="ml-1 inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 rounded-lg border border-border/80 bg-[hsl(222,47%,11%)] p-3 shadow-2xl shadow-black/40 animate-in fade-in-0 zoom-in-95 duration-100">
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Equivalent Value
          </p>
          <div className="space-y-1.5">
            {Object.entries(CURRENCY_RATES).map(([key, { symbol, code }]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/80 font-medium">{symbol} {code}</span>
                <span className="font-bold text-foreground">
                  {symbol} {formatCurrency(conversions[key])}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground/70 text-center">
              1 TC = R$ {BRL_PER_COIN}
            </p>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
            <div className="w-2 h-2 rotate-45 bg-[hsl(222,47%,11%)] border-r border-b border-border/80" />
          </div>
        </div>
      )}
    </div>
  );
}

function AuctionDetailModal({ auction, onClose }: { auction: SerializedAuction; onClose: () => void }) {
  const allSkills = getAllSkills(auction);
  const tags = getCharacterTags(auction);
  const vocColor = getVocationColor(auction.vocation || '');
  const price = auction.soldPrice;
  const ended = isAuctionEnded(auction.auctionEnd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-lg font-bold" style={{ color: vocColor }}>
              {auction.characterName}
            </span>
            {auction.url && (
              <a href={auction.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Level {auction.level || '?'} · {auction.vocation || 'Unknown'}
            {auction.gender && <span className="text-muted-foreground/60"> · {auction.gender}</span>}
          </p>
        </div>

        {/* Info fieldsets */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <FieldsetBox label="Server">
              <p className="text-sm font-medium">{auction.world || '—'}</p>
            </FieldsetBox>
            <FieldsetBox label={ended ? 'Ended' : 'Time Left'}>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-sm font-medium">
                  {ended ? formatAuctionDate(auction.auctionEnd) : formatAuctionEnd(auction.auctionEnd)}
                </p>
              </div>
            </FieldsetBox>
          </div>

          {/* Price bar */}
          <div className="rounded-lg bg-secondary/20 border border-border/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                {price != null && price > 0 ? (
                  <>
                    <div className="flex items-center">
                      <Coins className="h-4 w-4 text-emerald-400 mr-1.5" />
                      <p className="text-xl font-bold text-emerald-400">{formatNumber(price)} TC</p>
                      <PriceTooltip coins={price} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {auction.coinsPerLevel ? `${auction.coinsPerLevel.toFixed(1)} TC/lvl` : '\u2014'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No price set</p>
                )}
              </div>
              {auction.url && (
                <a
                  href={auction.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  View Auction
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* All Skills - SkillBox grid */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {allSkills.map(({ key, value }) => (
                <SkillBox key={key} skillKey={key} value={value} isTrained={value > SKILL_TRAINED_THRESHOLD} />
              ))}
            </div>
          </div>

          {/* Stats - two columns */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Character Stats</p>
            <div className="grid grid-cols-2 gap-1.5">
              {auction.hitPoints != null && (
                <div className="flex items-center gap-2 rounded-md bg-secondary/25 px-2.5 py-1.5">
                  <Heart className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-muted-foreground leading-none">HP</p>
                    <p className="text-xs font-semibold leading-tight">{formatNumber(auction.hitPoints)}</p>
                  </div>
                </div>
              )}
              {auction.mana != null && (
                <div className="flex items-center gap-2 rounded-md bg-secondary/25 px-2.5 py-1.5">
                  <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-muted-foreground leading-none">Mana</p>
                    <p className="text-xs font-semibold leading-tight">{formatNumber(auction.mana)}</p>
                  </div>
                </div>
              )}
              {auction.capacity != null && (
                <div className="flex items-center gap-2 rounded-md bg-secondary/25 px-2.5 py-1.5">
                  <Package className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-muted-foreground leading-none">Capacity</p>
                    <p className="text-xs font-semibold leading-tight">{formatNumber(auction.capacity)}</p>
                  </div>
                </div>
              )}
              {auction.speed != null && (
                <div className="flex items-center gap-2 rounded-md bg-secondary/25 px-2.5 py-1.5">
                  <Footprints className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-muted-foreground leading-none">Speed</p>
                    <p className="text-xs font-semibold leading-tight">{auction.speed}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Charm Breakdown */}
          {(auction.charmPoints != null && auction.charmPoints > 0) && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Charm Breakdown</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-purple-400">{formatNumber(auction.charmPoints)}</p>
                  <p className="text-[8px] text-muted-foreground">Total</p>
                </div>
                <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-emerald-400">{formatNumber(auction.spentCharmPoints || 0)}</p>
                  <p className="text-[8px] text-muted-foreground">Spent</p>
                </div>
                <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-center">
                  <p className="text-xs font-bold text-amber-400">{formatNumber(auction.unusedCharmPoints || 0)}</p>
                  <p className="text-[8px] text-muted-foreground">Unused</p>
                </div>
              </div>
            </div>
          )}

          {/* Features & Quests */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features & Quests</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Charm Expansion', has: auction.charmExpansion },
                { label: 'Prey Slot', has: (auction.preySlots || 0) >= 3 },
                { label: 'Loot Pouch', has: auction.hasLootPouch },
                { label: 'Soul War', has: auction.soulWarAvailable },
                { label: 'Primal Ordeal', has: auction.primalOrdealAvailable },
                { label: 'Sanguine Blood', has: auction.sanguineBloodAvailable },
              ].filter(item => item.has != null).map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 py-1">
                  {item.has ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-xs ${item.has ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Info Grid */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Additional Info</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { icon: Crown, color: 'text-amber-400', label: 'Boss Points', value: auction.bossPoints },
                { icon: Trophy, color: 'text-amber-400', label: 'Achievements', value: auction.achievementPoints },
                { icon: ScrollText, color: 'text-emerald-400', label: 'Bestiary', value: auction.bestiary },
                { icon: Footprints, color: 'text-blue-400', label: 'Mounts', value: auction.mountsCount },
                { icon: Star, color: 'text-pink-400', label: 'Outfits', value: auction.outfitsCount },
                { icon: Crown, color: 'text-amber-400', label: 'Titles', value: auction.titlesCount },
                { icon: Package, color: 'text-sky-400', label: 'Store Items', value: auction.storeItemsCount },
                { icon: Users, color: 'text-green-400', label: 'Hirelings', value: auction.hirelings },
                { icon: Target, color: 'text-cyan-400', label: 'Prey Wildcards', value: auction.preyWildcards },
                { icon: Flame, color: 'text-orange-400', label: 'Blessings', value: auction.blessingsCount },
                { icon: Coins, color: 'text-yellow-400', label: 'Gold', value: auction.gold },
                { icon: CircleDot, color: 'text-orange-400', label: 'Hunting Tasks', value: auction.huntingTaskPoints },
              ].filter(item => item.value != null && item.value > 0).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 ${item.color} shrink-0`} />
                    <span className="text-[11px] text-muted-foreground">{item.label}:</span>
                    <span className="text-[11px] font-semibold ml-auto tabular-nums">
                      {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
                    </span>
                  </div>
                );
              })}
              {auction.exaltedDust && (
                <div className="flex items-center gap-1.5">
                  <Gem className="h-3 w-3 text-violet-400 shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Exalted Dust:</span>
                  <span className="text-[11px] font-semibold ml-auto tabular-nums">{auction.exaltedDust}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Character Creation Date */}
          {auction.creationDate && (
            <div className="text-[10px] text-muted-foreground/60 text-center pt-1 border-t border-border/20">
              Created: {auction.creationDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldsetBox({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded px-2 pt-2.5 pb-1.5 ${className}`} style={{ border: '1px solid #4a4857', backgroundColor: '#2a2836' }}>
      <span className="absolute -top-2 left-2 px-1 text-[8px] font-semibold uppercase tracking-wider" style={{ backgroundColor: '#302e3a', color: '#7a7690' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function parseAuctionDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // Strip timezone abbreviations like "BRA", "CET" etc. that JS can't parse
  const cleaned = dateStr.replace(/\s+[A-Z]{2,4}$/, '').trim();
  const date = new Date(cleaned);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatAuctionEnd(dateStr: string | null): string {
  const date = parseAuctionDate(dateStr);
  if (!date) return '—';
  const now = new Date();
  if (date <= now) return 'Ended';
  return formatTimeRemaining(date);
}

function formatAuctionDate(dateStr: string | null): string {
  const date = parseAuctionDate(dateStr);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function isAuctionEnded(dateStr: string | null): boolean {
  const date = parseAuctionDate(dateStr);
  if (!date) return true;
  return date <= new Date();
}

function AuctionCard({ auction, onDetails }: { auction: SerializedAuction; onDetails: (auction: SerializedAuction) => void }) {
  const allSkills = getAllSkills(auction);
  const tags = getCharacterTags(auction);
  const vocColor = getVocationColor(auction.vocation || '');
  const price = auction.soldPrice;
  const ended = isAuctionEnded(auction.auctionEnd);
  const hasAuctionEnd = parseAuctionDate(auction.auctionEnd) !== null;

  // Left column stats (numeric values)
  const leftStats = [
    { icon: Sparkles, iconColor: '#a78bfa', label: 'Charm points:', value: auction.charmPoints, show: (auction.charmPoints || 0) > 0 },
    { icon: Skull, iconColor: '#f87171', label: 'Boss points:', value: auction.bossPoints, show: (auction.bossPoints || 0) > 0 },
    { icon: Trophy, iconColor: '#c8a052', label: 'Achievements:', value: auction.achievementPoints, show: (auction.achievementPoints || 0) > 0 },
  ].filter(s => s.show);

  // Right column features (checkmarks)
  const rightFeatures = [
    { label: 'Charm Expansion', has: !!auction.charmExpansion },
    { label: 'Prey Slot', has: (auction.preySlots || 0) >= 3 },
    { label: 'Loot Pouch', has: !!auction.hasLootPouch },
  ].filter(s => s.has);

  const hasStats = leftStats.length > 0 || rightFeatures.length > 0;

  return (
    <Card className="transition-all hover:shadow-xl hover:shadow-black/20 group flex flex-col overflow-hidden" style={{ backgroundColor: '#302e3a', border: '1px solid #4a4857' }}>
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header: name + details button */}
        <div className="px-2.5 pt-2.5 pb-0.5">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-bold truncate" style={{ color: '#4ade80' }}>
                  {auction.characterName}
                </span>
                {auction.url && (
                  <a href={auction.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: '#8a8698' }}>
                Level {auction.level || '?'} · {auction.vocation || 'Unknown'}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDetails(auction); }}
              className="shrink-0 rounded-md p-0.5 hover:bg-white/5 transition-colors"
              style={{ color: '#7a7690' }}
              title="View details"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Row 1: Server fieldset box */}
        <div className="px-2.5 pb-1">
          <FieldsetBox label="Server">
            <p className="text-[11px] font-medium" style={{ color: '#d4d0e0' }}>{auction.world || '—'}</p>
          </FieldsetBox>
        </div>

        {/* Row 2: Auction End + Min Bid in bordered boxes side by side */}
        <div className="px-2.5 pb-1.5">
          <div className="grid grid-cols-2 gap-1">
            <FieldsetBox label={hasAuctionEnd && !ended ? 'Auction End' : 'Status'}>
              {hasAuctionEnd && !ended ? (
                <p className="text-[10px] font-medium" style={{ color: '#d4d0e0' }}>{formatAuctionEnd(auction.auctionEnd)}</p>
              ) : (
                <p className="text-[10px] font-bold" style={{ color: '#4ade80' }}>Active</p>
              )}
            </FieldsetBox>
            {price != null && price > 0 ? (
              <FieldsetBox label={auction.auctionStatus === 'sold' ? 'Sold For' : 'Min. Bid'}>
                <div className="flex items-center gap-0.5">
                  <Coins className="h-3 w-3" style={{ color: '#4ade80' }} />
                  <p className="text-[10px] font-bold" style={{ color: '#4ade80' }}>{formatNumber(price)}</p>
                  <PriceTooltip coins={price} />
                </div>
              </FieldsetBox>
            ) : (
              <FieldsetBox label="Bid">
                <p className="text-[10px]" style={{ color: '#7a7690' }}>—</p>
              </FieldsetBox>
            )}
          </div>
        </div>

        {/* Skills — 2-column list with number box + label, ALL skills shown */}
        <div className="px-2.5 pb-1.5">
          <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
            {allSkills.map(({ key, value }) => (
              <SkillBox key={key} skillKey={key} value={value} isTrained={value > SKILL_TRAINED_THRESHOLD} />
            ))}
          </div>
        </div>

        {/* Divider */}
        {hasStats && <div className="mx-2.5" style={{ borderTop: '1px solid #4a4857' }} />}

        {/* Two-column stats: left = numeric values, right = checkmarks */}
        {hasStats && (
          <div className="px-2.5 py-1.5">
            <div className="grid grid-cols-2 gap-x-2">
              {/* Left column: numeric stats */}
              <div className="space-y-px">
                {leftStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="flex items-center gap-0.5">
                      <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: stat.iconColor }} />
                      <span className="text-[9px] truncate" style={{ color: '#8a8698' }}>{stat.label}</span>
                      <span className="text-[9px] font-bold ml-auto tabular-nums" style={{ color: '#d4d0e0' }}>
                        {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Right column: checkmark features */}
              <div className="space-y-px">
                {rightFeatures.map((item) => (
                  <div key={item.label} className="flex items-center gap-0.5">
                    <Check className="h-2.5 w-2.5 shrink-0" style={{ color: '#4ade80' }} />
                    <span className="text-[9px]" style={{ color: '#d4d0e0' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Spacer to push tags to bottom */}
        <div className="flex-1" />

        {/* Tags row at bottom */}
        {tags.length > 0 && (
          <div className="px-2.5 pb-2">
            <div className="flex flex-wrap gap-0.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full px-1.5 py-px text-[9px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="rounded-full px-1.5 py-px text-[9px] font-medium" style={{ backgroundColor: '#3a3848', color: '#8a8698' }}>
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AuctionsClient({ initialAuctions, worlds, vocations, initialSearch = '' }: AuctionsClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedWorld, setSelectedWorld] = useState('');
  const [selectedVocation, setSelectedVocation] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortField, setSortField] = useState<SortField>('soldPrice');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [detailAuction, setDetailAuction] = useState<SerializedAuction | null>(null);

  const filtered = useMemo(() => {
    let result = initialAuctions;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.characterName.toLowerCase().includes(q));
    }
    if (selectedWorld) result = result.filter((a) => a.world === selectedWorld);
    if (selectedVocation) result = result.filter((a) => a.vocation === selectedVocation);
    if (minLevel) result = result.filter((a) => (a.level || 0) >= parseInt(minLevel));
    if (maxLevel) result = result.filter((a) => (a.level || 0) <= parseInt(maxLevel));
    if (minPrice) result = result.filter((a) => (a.soldPrice || 0) >= parseInt(minPrice));
    if (maxPrice) result = result.filter((a) => (a.soldPrice || 0) <= parseInt(maxPrice));

    result.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortOrder === 'desc' ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal);
    });

    return result;
  }, [initialAuctions, search, selectedWorld, selectedVocation, minLevel, maxLevel, minPrice, maxPrice, sortField, sortOrder]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearch('');
    setSelectedWorld('');
    setSelectedVocation('');
    setMinLevel('');
    setMaxLevel('');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
  };

  const hasActiveFilters = search || selectedWorld || selectedVocation || minLevel || maxLevel || minPrice || maxPrice;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search + Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by character name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-lg border border-input bg-card/50 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm transition-colors ${showFilters ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-card/50 hover:bg-accent'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                !
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex h-10 items-center gap-1 rounded-lg border border-input bg-card/50 px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">World</label>
              <Select value={selectedWorld || '__all__'} onValueChange={(v) => { setSelectedWorld(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="All Worlds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Worlds</SelectItem>
                  {worlds.sort().map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vocation</label>
              <Select value={selectedVocation || '__all__'} onValueChange={(v) => { setSelectedVocation(v === '__all__' ? '' : v); setPage(1); }}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="All Vocations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Vocations</SelectItem>
                  {vocations.sort().map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Level Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minLevel}
                  onChange={(e) => { setMinLevel(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxLevel}
                  onChange={(e) => { setMaxLevel(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Price Range (TC)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sort Bar + Count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} auction{filtered.length !== 1 ? 's' : ''} found
        </p>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['soldPrice', 'Price'],
            ['level', 'Level'],
            ['coinsPerLevel', 'TC/Level'],
            ['magicLevel', 'Magic Level'],
            ['charmPoints', 'Charm'],
          ] as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex h-8 items-center gap-1 rounded-md px-3 text-xs transition-colors ${sortField === field ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
            >
              {label}
              {sortField === field && (
                sortOrder === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Auction Card Grid — fixed card width, auto-fill columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {paginated.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            onDetails={setDetailAuction}
          />
        ))}
      </div>

      {/* Detail Modal */}
      {detailAuction && (
        <AuctionDetailModal auction={detailAuction} onClose={() => setDetailAuction(null)} />
      )}

      {/* Empty State */}
      {paginated.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">No auctions found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded-md border border-input bg-card/50 px-3 py-1.5 text-sm disabled:opacity-30"
          >
            First
          </button>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="rounded-md border border-input bg-card/50 px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-3 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="rounded-md border border-input bg-card/50 px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="rounded-md border border-input bg-card/50 px-3 py-1.5 text-sm disabled:opacity-30"
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
