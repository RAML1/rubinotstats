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
  Fish,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

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
  url: string | null;
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

// Currency conversion rates (base: 1 coin = 11 BRL)
const BRL_PER_COIN = 11;
const CURRENCY_RATES: Record<string, { symbol: string; rate: number; code: string }> = {
  BRL: { symbol: 'R$', rate: 1, code: 'BRL' },
  USD: { symbol: '$', rate: 0.18, code: 'USD' },
  EUR: { symbol: '\u20ac', rate: 0.17, code: 'EUR' },
  PLN: { symbol: 'z\u0142', rate: 0.73, code: 'PLN' },
  MXN: { symbol: '$', rate: 3.58, code: 'MXN' },
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

function getMainSkill(auction: SerializedAuction): { name: string; value: number; icon: React.ElementType } {
  const voc = auction.vocation || '';
  if (voc.includes('Knight')) {
    const best = Math.max(auction.sword || 0, auction.axe || 0, auction.club || 0);
    return { name: 'Melee', value: best, icon: Swords };
  }
  if (voc.includes('Paladin')) return { name: 'Distance', value: auction.distance || 0, icon: Crosshair };
  if (voc.includes('Sorcerer') || voc.includes('Druid')) return { name: 'ML', value: auction.magicLevel || 0, icon: Wand2 };
  return { name: 'ML', value: auction.magicLevel || 0, icon: Wand2 };
}

function getCharacterTags(auction: SerializedAuction): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = [];
  if ((auction.charmPoints || 0) >= 3000) tags.push({ label: 'High Charm', color: '#a855f7' });
  if ((auction.mountsCount || 0) >= 20) tags.push({ label: `${auction.mountsCount} Mounts`, color: '#3b82f6' });
  if ((auction.outfitsCount || 0) >= 30) tags.push({ label: `${auction.outfitsCount} Outfits`, color: '#ec4899' });
  if ((auction.achievementPoints || 0) >= 100) tags.push({ label: `${auction.achievementPoints} Achiev.`, color: '#f59e0b' });
  if (auction.charmExpansion) tags.push({ label: 'Charm Exp.', color: '#8b5cf6' });
  if ((auction.preySlots || 0) >= 3) tags.push({ label: 'Extra Prey', color: '#06b6d4' });
  if ((auction.hirelings || 0) >= 1) tags.push({ label: `${auction.hirelings} Hirelings`, color: '#10b981' });
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
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur animate-in fade-in-0 zoom-in-95 duration-100">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Equivalent Value
          </p>
          <div className="space-y-1.5">
            {Object.entries(CURRENCY_RATES).map(([key, { symbol, code }]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{symbol} {code}</span>
                <span className="font-semibold text-foreground">
                  {symbol} {formatCurrency(conversions[key])}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground/60 text-center">
              1 TC = R$ {BRL_PER_COIN}
            </p>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
            <div className="w-2 h-2 rotate-45 bg-background border-r border-b border-border" />
          </div>
        </div>
      )}
    </div>
  );
}

function AuctionCard({ auction }: { auction: SerializedAuction }) {
  const mainSkill = getMainSkill(auction);
  const tags = getCharacterTags(auction);
  const vocColor = getVocationColor(auction.vocation || '');
  const price = auction.soldPrice || 0;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur transition-all hover:bg-card/80 hover:border-border/80 hover:shadow-lg hover:shadow-black/10 group flex flex-col">
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header: vocation color bar + character info */}
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg" style={{ backgroundColor: vocColor }} />

          <div className="pt-4 px-4 pb-3">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white shadow-md"
                style={{ backgroundColor: vocColor }}
              >
                {auction.characterName[0].toUpperCase()}
              </div>

              {/* Name + Vocation */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{auction.characterName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 leading-none"
                    style={{ borderColor: vocColor, color: vocColor }}
                  >
                    {auction.vocation}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{auction.world}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Level + Main Skill */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-secondary/40 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Level</p>
              <p className="text-lg font-bold text-foreground leading-tight">{auction.level || '?'}</p>
            </div>
            <div className="rounded-md bg-secondary/40 px-2.5 py-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{mainSkill.name}</p>
              <p className="text-lg font-bold text-foreground leading-tight">{mainSkill.value}</p>
            </div>
          </div>
        </div>

        {/* Skills Row */}
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1">
            {auction.magicLevel ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Wand2 className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">ML</span>
                <span className="font-semibold">{auction.magicLevel}</span>
              </div>
            ) : null}
            {auction.sword ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Swords className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.sword}</span>
              </div>
            ) : null}
            {auction.axe ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Swords className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.axe}</span>
              </div>
            ) : null}
            {auction.club ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Swords className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.club}</span>
              </div>
            ) : null}
            {auction.distance ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Crosshair className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.distance}</span>
              </div>
            ) : null}
            {auction.shielding ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Shield className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.shielding}</span>
              </div>
            ) : null}
            {auction.fishing ? (
              <div className="flex items-center gap-1 rounded bg-secondary/30 px-1.5 py-0.5 text-[10px]">
                <Fish className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-semibold">{auction.fishing}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-secondary/50">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spacer to push price to bottom */}
        <div className="flex-1" />

        {/* Price Footer */}
        <div className="border-t border-border/30 px-4 py-3 mt-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <p className="text-xl font-bold text-emerald-400">
                  {formatNumber(price)} TC
                </p>
                <PriceTooltip coins={price} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {auction.coinsPerLevel ? `${auction.coinsPerLevel.toFixed(1)} TC/lvl` : '\u2014'}
              </p>
            </div>
            {auction.url && (
              <a
                href={auction.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                View
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
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
              <select
                value={selectedWorld}
                onChange={(e) => { setSelectedWorld(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Worlds</option>
                {worlds.sort().map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vocation</label>
              <select
                value={selectedVocation}
                onChange={(e) => { setSelectedVocation(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All Vocations</option>
                {vocations.sort().map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
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

      {/* Auction Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paginated.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </div>

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
