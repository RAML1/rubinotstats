'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  X,
  Swords,
  Shield,
  Crosshair,
  Wand2,
  Sparkles,
  Fish,
  Trophy,
  Star,
  Crown,
  Heart,
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

const ITEMS_PER_PAGE = 20;

function getMainSkill(auction: SerializedAuction): { name: string; value: number } {
  const voc = auction.vocation || '';
  if (voc.includes('Knight')) return { name: 'Sword', value: Math.max(auction.sword || 0, auction.axe || 0, auction.club || 0) };
  if (voc.includes('Paladin')) return { name: 'Distance', value: auction.distance || 0 };
  if (voc.includes('Sorcerer') || voc.includes('Druid')) return { name: 'ML', value: auction.magicLevel || 0 };
  return { name: 'ML', value: auction.magicLevel || 0 };
}

function getCharacterTags(auction: SerializedAuction): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = [];
  if ((auction.charmPoints || 0) >= 3000) tags.push({ label: 'High Charm', color: '#a855f7' });
  if ((auction.mountsCount || 0) >= 20) tags.push({ label: `${auction.mountsCount} Mounts`, color: '#3b82f6' });
  if ((auction.outfitsCount || 0) >= 30) tags.push({ label: `${auction.outfitsCount} Outfits`, color: '#ec4899' });
  if ((auction.achievementPoints || 0) >= 100) tags.push({ label: `${auction.achievementPoints} Achievements`, color: '#f59e0b' });
  if (auction.charmExpansion) tags.push({ label: 'Charm Expansion', color: '#8b5cf6' });
  if ((auction.preySlots || 0) >= 3) tags.push({ label: 'Extra Prey Slots', color: '#06b6d4' });
  if ((auction.hirelings || 0) >= 1) tags.push({ label: `${auction.hirelings} Hirelings`, color: '#10b981' });
  return tags;
}

function SkillPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 text-xs">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

      {/* Auction Cards */}
      <div className="space-y-3">
        {paginated.map((auction) => {
          const mainSkill = getMainSkill(auction);
          const tags = getCharacterTags(auction);
          const isExpanded = expandedId === auction.id;
          const vocColor = getVocationColor(auction.vocation || '');

          return (
            <Card
              key={auction.id}
              className="border-border/50 bg-card/50 backdrop-blur transition-colors hover:bg-card/80"
            >
              <CardContent className="p-0">
                {/* Main Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : auction.id)}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  {/* Avatar */}
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ backgroundColor: vocColor }}
                  >
                    {auction.characterName[0].toUpperCase()}
                  </div>

                  {/* Character Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-semibold">{auction.characterName}</p>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] px-1.5 py-0"
                        style={{ borderColor: vocColor, color: vocColor }}
                      >
                        {auction.vocation}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>Level <strong className="text-foreground">{auction.level}</strong></span>
                      <span>{mainSkill.name} <strong className="text-foreground">{mainSkill.value}</strong></span>
                      <span>{auction.world}</span>
                    </div>
                  </div>

                  {/* Tags (desktop) */}
                  <div className="hidden flex-wrap gap-1.5 lg:flex">
                    {tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag.label}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-emerald-400">
                      {formatNumber(auction.soldPrice || 0)} TC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {auction.coinsPerLevel ? `${auction.coinsPerLevel.toFixed(1)} TC/lvl` : '—'}
                    </p>
                  </div>

                  {/* Expand */}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3">
                    {/* Tags (mobile) */}
                    {tags.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5 lg:hidden">
                        {tags.map((tag) => (
                          <span
                            key={tag.label}
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Skills Grid */}
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Combat Skills</p>
                      <div className="flex flex-wrap gap-2">
                        <SkillPill icon={Wand2} label="Magic" value={auction.magicLevel} />
                        <SkillPill icon={Swords} label="Sword" value={auction.sword} />
                        <SkillPill icon={Swords} label="Axe" value={auction.axe} />
                        <SkillPill icon={Swords} label="Club" value={auction.club} />
                        <SkillPill icon={Crosshair} label="Dist" value={auction.distance} />
                        <SkillPill icon={Shield} label="Shield" value={auction.shielding} />
                        <SkillPill icon={Swords} label="Fist" value={auction.fist} />
                        <SkillPill icon={Fish} label="Fish" value={auction.fishing} />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      <StatItem icon={Heart} label="HP" value={auction.hitPoints} />
                      <StatItem icon={Sparkles} label="Mana" value={auction.mana} />
                      <StatItem icon={Star} label="Charm Pts" value={auction.charmPoints} />
                      <StatItem icon={Trophy} label="Achievements" value={auction.achievementPoints} />
                      <StatItem icon={Crown} label="Boss Pts" value={auction.bossPoints} />
                      <StatItem icon={Swords} label="Hunt Tasks" value={auction.huntingTaskPoints} />
                      <StatItem icon={Star} label="Mounts" value={auction.mountsCount} />
                      <StatItem icon={Star} label="Outfits" value={auction.outfitsCount} />
                      <StatItem icon={Star} label="Titles" value={auction.titlesCount} />
                      <StatItem icon={Star} label="Linked Tasks" value={auction.linkedTasks} />
                      <StatItem icon={Star} label="Prey Slots" value={auction.preySlots} />
                      <StatItem icon={Star} label="Hirelings" value={auction.hirelings} />
                    </div>

                    {/* Auction Info Footer */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      {auction.auctionStart && <span>Started: {auction.auctionStart}</span>}
                      {auction.auctionEnd && <span>Ended: {auction.auctionEnd}</span>}
                      {auction.gender && <span>{auction.gender}</span>}
                      {auction.experience && <span>Exp: {auction.experience}</span>}
                      {auction.url && (
                        <a href={auction.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          View on RubinOT
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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

function StatItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{formatNumber(value)}</p>
      </div>
    </div>
  );
}
