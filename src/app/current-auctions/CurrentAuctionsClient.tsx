'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
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
  Skull,
  Fish,
  Hand,
  Check,
  Clock,
  Eye,
  Coins,
  ArrowRightLeft,
  Globe,
  Timer,
  Heart,
  Zap,
  Package,
  Footprints,
  ScrollText,
  Crown,
  Star,
  Users,
  Target,
  CircleDot,
  Flame,
  Gem,
  CalendarCheck,
  Diamond,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { formatNumber, getVocationColor, formatTimeRemaining } from '@/lib/utils/formatters';

// ── Types ──────────────────────────────────────────────────────────────

type SerializedCurrentAuction = {
  id: number;
  externalId: string;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  minimumBid: number | null;
  currentBid: number | null;
  hasBeenBidOn: boolean;
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
  // Skill percentages
  magicLevelPct: number | null;
  fistPct: number | null;
  clubPct: number | null;
  swordPct: number | null;
  axePct: number | null;
  distancePct: number | null;
  shieldingPct: number | null;
  fishingPct: number | null;
  // Outfit, gems, weekly task, display items
  outfitImageUrl: string | null;
  gems: string | null;
  weeklyTaskExpansion: boolean | null;
  battlePassDeluxe: boolean | null;
  displayItems: string | null;
  outfitNames: string | null;
  mountNames: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type WorldTypeInfo = {
  worldName: string;
  pvpType: string;
  isRtc: boolean;
};

type ValuationData = {
  estimatedValue: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
};

type FeaturedAuctionInfo = {
  auctionExternalId: string;
  featuredId: number;
  userName: string | null;
  userImage: string | null;
  userId: string;
};

interface CurrentAuctionsClientProps {
  initialAuctions: SerializedCurrentAuction[];
  worlds: string[];
  vocations: string[];
  worldTypes: WorldTypeInfo[];
  valuations: Record<number, ValuationData>;
  initialSearch?: string;
  userIsPremium?: boolean;
  userId?: string | null;
  featuredAuctionIds?: FeaturedAuctionInfo[];
}

type SortField = 'currentBid' | 'minimumBid' | 'level' | 'magicLevel' | 'charmPoints' | 'auctionEnd';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 24;

// ── Currency conversion ────────────────────────────────────────────────

// 1000 TC ≈ R$ 100 → 1 TC ≈ R$ 0.10
const BRL_PER_COIN = 0.10;
const CURRENCY_RATES: Record<string, { symbol: string; rate: number; code: string }> = {
  BRL: { symbol: 'R$', rate: 1, code: 'BRL' },
  USD: { symbol: '$', rate: 0.17, code: 'USD' },
  MXN: { symbol: '$', rate: 3.45, code: 'MXN' },
  VES: { symbol: 'Bs.', rate: 63.0, code: 'VES' },
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

// ── Skill configuration ────────────────────────────────────────────────

const SKILL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; maxRef: number }> = {
  magicLevel: { label: 'Magic', icon: Wand2, color: '#c084fc', maxRef: 130 },
  sword: { label: 'Sword', icon: Swords, color: '#f87171', maxRef: 130 },
  axe: { label: 'Axe', icon: Swords, color: '#fb923c', maxRef: 130 },
  club: { label: 'Club', icon: Swords, color: '#f87171', maxRef: 130 },
  distance: { label: 'Distance', icon: Crosshair, color: '#fbbf24', maxRef: 130 },
  shielding: { label: 'Shielding', icon: Shield, color: '#60a5fa', maxRef: 130 },
  fist: { label: 'Fist', icon: Hand, color: '#a78bfa', maxRef: 130 },
  fishing: { label: 'Fishing', icon: Fish, color: '#94a3b8', maxRef: 130 },
};

const SKILL_TRAINED_THRESHOLD = 20;

const SKILL_PCT_MAP: Record<string, keyof SerializedCurrentAuction> = {
  magicLevel: 'magicLevelPct',
  fist: 'fistPct',
  club: 'clubPct',
  sword: 'swordPct',
  axe: 'axePct',
  distance: 'distancePct',
  shielding: 'shieldingPct',
  fishing: 'fishingPct',
};

function getAllSkills(auction: SerializedCurrentAuction): Array<{ key: string; value: number; pct: number | null }> {
  const voc = auction.vocation || '';
  const skills: Array<{ key: string; value: number; pct: number | null }> = [];

  const push = (key: string, value: number | null) => {
    if (!value) return;
    const pctKey = SKILL_PCT_MAP[key];
    const pct = pctKey ? (auction[pctKey] as number | null) : null;
    skills.push({ key, value, pct });
  };

  if (voc.includes('Sorcerer') || voc.includes('Druid')) {
    push('magicLevel', auction.magicLevel);
    push('shielding', auction.shielding);
    push('distance', auction.distance);
    push('fist', auction.fist);
    push('sword', auction.sword);
    push('axe', auction.axe);
    push('club', auction.club);
    push('fishing', auction.fishing);
  } else if (voc.includes('Paladin')) {
    push('distance', auction.distance);
    push('magicLevel', auction.magicLevel);
    push('shielding', auction.shielding);
    push('fist', auction.fist);
    push('sword', auction.sword);
    push('axe', auction.axe);
    push('club', auction.club);
    push('fishing', auction.fishing);
  } else if (voc.includes('Knight')) {
    const melee = [
      { key: 'sword', value: auction.sword || 0 },
      { key: 'axe', value: auction.axe || 0 },
      { key: 'club', value: auction.club || 0 },
    ].sort((a, b) => b.value - a.value);
    melee.filter((s) => s.value > 0).forEach((s) => push(s.key, s.value));
    push('shielding', auction.shielding);
    push('magicLevel', auction.magicLevel);
    push('distance', auction.distance);
    push('fist', auction.fist);
    push('fishing', auction.fishing);
  } else {
    push('magicLevel', auction.magicLevel);
    push('shielding', auction.shielding);
    push('distance', auction.distance);
    push('fist', auction.fist);
    push('sword', auction.sword);
    push('axe', auction.axe);
    push('club', auction.club);
    push('fishing', auction.fishing);
  }

  return skills;
}

function getCharacterTags(auction: SerializedCurrentAuction): Array<{ label: string; color: string }> {
  const tags: Array<{ label: string; color: string }> = [];
  if ((auction.charmPoints || 0) >= 2000) tags.push({ label: 'Many charms', color: '#10b981' });
  if ((auction.mountsCount || 0) >= 15) tags.push({ label: 'Many mounts', color: '#06b6d4' });
  if ((auction.outfitsCount || 0) >= 15) tags.push({ label: 'Many outfits', color: '#a78bfa' });
  if (auction.soulWarAvailable) tags.push({ label: 'Soul War available', color: '#f59e0b' });
  if (auction.primalOrdealAvailable) tags.push({ label: 'Primal Ordeal available', color: '#f97316' });
  if (auction.sanguineBloodAvailable) tags.push({ label: 'Sanguine available', color: '#ef4444' });
  if (auction.hasLootPouch) tags.push({ label: 'Loot Pouch', color: '#f59e0b' });
  if ((auction.storeItemsCount || 0) >= 10) tags.push({ label: 'Store cosmetics', color: '#ec4899' });
  return tags;
}

// ── Shared UI Components ───────────────────────────────────────────────

function SkillBox({ skillKey, value, isTrained, pct }: { skillKey: string; value: number; isTrained: boolean; pct?: number | null }) {
  const config = SKILL_CONFIG[skillKey];
  if (!config) return null;

  // Use real percentage from scraper if available, otherwise estimate from value/maxRef
  const fillPct = pct != null
    ? Math.min(100, Math.max(0, pct))
    : Math.min(100, Math.max(0, (value / config.maxRef) * 100));

  const boxStyle = isTrained
    ? { backgroundColor: '#2a5a2a', color: '#4ade80', border: '1px solid #3a7a3a' }
    : { backgroundColor: '#604a1e', color: '#d4a84a', border: '1px solid #7a5f2a' };

  const barColor = isTrained ? config.color : '#7a5f2a';

  return (
    <div className="flex items-center gap-1">
      <div
        className="flex h-[22px] w-7 items-center justify-center rounded text-[10px] font-bold tabular-nums shrink-0"
        style={boxStyle}
      >
        {value}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] leading-none" style={{ color: isTrained ? '#b0b0c0' : '#8a8698' }}>{config.label}</span>
          {pct != null && (
            <span className="text-[8px] tabular-nums" style={{ color: '#5a5870' }}>{pct.toFixed(1)}%</span>
          )}
        </div>
        <div className="h-[3px] w-full rounded-full mt-0.5" style={{ backgroundColor: '#1e1c2a' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fillPct}%`, backgroundColor: barColor, opacity: isTrained ? 0.8 : 0.4 }}
          />
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

function PriceTooltip({ coins }: { coins: number }) {
  const [show, setShow] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const conversions = convertPrice(coins);

  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipW = 224; // w-56 = 14rem = 224px
      const tooltipH = 180; // approximate height
      // Try to position above the icon, centered horizontally
      let top = rect.top - tooltipH - 8;
      let left = rect.left + rect.width / 2 - tooltipW / 2;
      // If it would go off the top, position below instead
      if (top < 8) top = rect.bottom + 8;
      // Clamp horizontal
      if (left < 8) left = 8;
      if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - tooltipW - 8;
      setPos({ top, left });
    }
  }, [show]);

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="ml-1 inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {show && pos && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] w-56 rounded-lg p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100"
          style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #3a3858',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            top: pos.top,
            left: pos.left,
          }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Approximate Value
          </p>
          <div className="space-y-1.5">
            {Object.entries(CURRENCY_RATES).map(([key, { symbol, code }]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: '#9a96b0' }}>{symbol} {code}</span>
                <span className="font-bold" style={{ color: '#e4e0f0' }}>
                  ~ {symbol} {formatCurrency(conversions[key])}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #3a3858' }}>
            <p className="text-[10px] text-center" style={{ color: '#7a7690' }}>
              Based on 1 TC ≈ R$ {BRL_PER_COIN}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Transfer Cost Simulator ────────────────────────────────────────────

// Transfer rules from the game:
// Same PvP type → 990 Rubini Coins, 7 days wait
// Different PvP type → 1890 Rubini Coins, 21 days wait
// Updated to RTC → Former RTC: +500,000 gold per level additional tax

// ── Custom Dropdown for world selection ────────────────────────────────

function WorldDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedLabel = options.find(o => o.value === value)?.label || 'Select world...';

  return (
    <div className="relative flex-1 min-w-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center justify-between w-full h-6 rounded px-1.5 text-[9px] transition-colors"
        style={{
          backgroundColor: '#1e1c2a',
          border: `1px solid ${open ? '#6c63ff' : '#3a3848'}`,
          color: value ? '#d4d0e0' : '#7a7690',
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-2.5 w-2.5 shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#7a7690' }} />
      </button>

      {open && (
        <div
          className="absolute z-[100] mt-1 w-full max-h-48 overflow-y-auto rounded-md py-1 shadow-xl"
          style={{
            backgroundColor: '#1e1c2a',
            border: '1px solid #3a3858',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="flex w-full items-center px-2 py-1.5 text-[9px] transition-colors hover:bg-white/5"
            style={{ color: !value ? '#6c63ff' : '#7a7690' }}
          >
            {!value && <Check className="h-2.5 w-2.5 mr-1.5 shrink-0" style={{ color: '#6c63ff' }} />}
            <span className={!value ? '' : 'pl-4'}>Select world...</span>
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex w-full items-center px-2 py-1.5 text-[9px] transition-colors hover:bg-white/5"
              style={{ color: value === opt.value ? '#d4d0e0' : '#9a96b0' }}
            >
              {value === opt.value && <Check className="h-2.5 w-2.5 mr-1.5 shrink-0" style={{ color: '#6c63ff' }} />}
              <span className={value === opt.value ? '' : 'pl-4'}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransferSimulator({
  sourceWorld,
  characterLevel,
  bidPrice,
  worldTypes,
}: {
  sourceWorld: string;
  characterLevel: number;
  bidPrice: number | null;
  worldTypes: WorldTypeInfo[];
}) {
  const [targetWorld, setTargetWorld] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const sourceType = worldTypes.find(w => w.worldName === sourceWorld);
  const targetType = worldTypes.find(w => w.worldName === targetWorld);

  const transferInfo = useMemo(() => {
    if (!sourceType || !targetType || sourceWorld === targetWorld) return null;

    const samePvpType = sourceType.pvpType === targetType.pvpType;
    const rubiniCoins = samePvpType ? 990 : 1890;
    const waitDays = samePvpType ? 7 : 21;

    let goldTax = 0;
    if (sourceType.isRtc && !targetType.isRtc) {
      goldTax = characterLevel * 500000;
    }

    return { rubiniCoins, waitDays, goldTax, samePvpType };
  }, [sourceType, targetType, sourceWorld, targetWorld, characterLevel]);

  const worldOptions = worldTypes
    .filter(w => w.worldName !== sourceWorld)
    .map(w => ({ value: w.worldName, label: `${w.worldName} (${w.pvpType})` }));

  if (!isOpen) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        className="flex items-center justify-center gap-1.5 w-full rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors"
        style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#a09cb0' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2d2b3d'; e.currentTarget.style.color = '#d4d0e0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#252333'; e.currentTarget.style.color = '#a09cb0'; }}
      >
        <ArrowRightLeft className="h-3 w-3" />
        Calculate Transfer Fee
      </button>
    );
  }

  return (
    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
      <div className="rounded px-2 py-1.5" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: '#7a7690' }}>
            Transfer Simulator
          </span>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground/50 hover:text-muted-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Globe className="h-2.5 w-2.5 shrink-0" style={{ color: '#7a7690' }} />
            <span className="text-[9px] truncate" style={{ color: '#8a8698' }}>{sourceWorld}</span>
          </div>
          <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" style={{ color: '#4a4857' }} />
          <WorldDropdown value={targetWorld} onChange={setTargetWorld} options={worldOptions} />
        </div>

        {transferInfo && (
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded px-1.5 py-1" style={{ backgroundColor: '#302e3a' }}>
              <div className="flex items-center gap-0.5">
                <Coins className="h-2.5 w-2.5" style={{ color: '#c8a052' }} />
                <span className="text-[9px] font-bold" style={{ color: '#d4a84a' }}>
                  {formatNumber(transferInfo.rubiniCoins)} RC
                </span>
              </div>
              <span className="text-[8px]" style={{ color: '#7a7690' }}>
                {transferInfo.samePvpType ? 'Same PvP' : 'Diff PvP'}
              </span>
            </div>
            <div className="rounded px-1.5 py-1" style={{ backgroundColor: '#302e3a' }}>
              <div className="flex items-center gap-0.5">
                <Timer className="h-2.5 w-2.5" style={{ color: '#60a5fa' }} />
                <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>
                  {transferInfo.waitDays} days
                </span>
              </div>
              <span className="text-[8px]" style={{ color: '#7a7690' }}>Wait time</span>
            </div>
            {transferInfo.goldTax > 0 && (
              <div className="col-span-2 rounded px-1.5 py-1" style={{ backgroundColor: '#3a2020' }}>
                <div className="flex items-center gap-0.5">
                  <Coins className="h-2.5 w-2.5" style={{ color: '#f87171' }} />
                  <span className="text-[9px] font-bold" style={{ color: '#f87171' }}>
                    {formatNumber(transferInfo.goldTax)} gold tax
                  </span>
                </div>
                <span className="text-[8px]" style={{ color: '#a08080' }}>
                  RTC → Former RTC ({formatNumber(500000)}/lvl × {characterLevel})
                </span>
              </div>
            )}
            {bidPrice != null && bidPrice > 0 && (
              <div className="col-span-2 rounded px-1.5 py-1 mt-0.5" style={{ backgroundColor: '#1a2a1a', border: '1px solid #2a4a2a' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold uppercase tracking-wider" style={{ color: '#7a9a7a' }}>Total Cost</span>
                  <span className="text-[10px] font-bold" style={{ color: '#4ade80' }}>
                    {formatNumber(bidPrice + transferInfo.rubiniCoins)} RC
                  </span>
                </div>
                <span className="text-[8px]" style={{ color: '#5a7a5a' }}>
                  {formatNumber(bidPrice)} bid + {formatNumber(transferInfo.rubiniCoins)} transfer
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auction Date Helpers ───────────────────────────────────────────────

function parseAuctionDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // Strip timezone abbreviation (BRA, CET, CEST, BRT, BRST, UTC, etc.)
  const cleaned = dateStr.replace(/\s+[A-Z]{2,5}$/, '').trim();
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

function isAuctionEnded(dateStr: string | null): boolean {
  const date = parseAuctionDate(dateStr);
  if (!date) return false;
  return date <= new Date();
}

// ── Live Countdown Hook ──────────────────────────────────────────────

function useCountdown() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000); // update every 30s
    return () => clearInterval(id);
  }, []);
  return tick;
}

// ── Detail Modal ───────────────────────────────────────────────────────

function AuctionDetailModal({
  auction,
  worldTypes,
  valuation,
  onClose,
  userIsPremium = false,
}: {
  auction: SerializedCurrentAuction;
  worldTypes: WorldTypeInfo[];
  valuation?: ValuationData;
  onClose: () => void;
  userIsPremium?: boolean;
}) {
  const allSkills = getAllSkills(auction);
  const tags = getCharacterTags(auction);
  const vocColor = getVocationColor(auction.vocation || '');
  const bidPrice = auction.currentBid ?? auction.minimumBid;
  const ended = isAuctionEnded(auction.auctionEnd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />

      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: '#1e1c2a', border: '1px solid #4a4857', boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
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
              <div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <p className="text-sm font-medium">
                    {ended ? 'Ended' : formatAuctionEnd(auction.auctionEnd)}
                  </p>
                </div>
                {auction.auctionEnd && (
                  <p className="text-[10px] mt-0.5 pl-5" style={{ color: '#7a7690' }}>
                    {auction.auctionEnd.replace(/\s+[A-Z]{2,4}$/, '')}
                  </p>
                )}
              </div>
            </FieldsetBox>
          </div>

          {/* Bid bar */}
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
            <div className="flex items-center justify-between">
              <div>
                {bidPrice != null && bidPrice > 0 ? (
                  <>
                    <div className="flex items-center">
                      <Coins className="h-4 w-4 mr-1.5" style={{ color: auction.hasBeenBidOn ? '#fbbf24' : '#4ade80' }} />
                      <p className="text-xl font-bold" style={{ color: auction.hasBeenBidOn ? '#fbbf24' : '#4ade80' }}>{formatNumber(bidPrice)} TC</p>
                      <PriceTooltip coins={bidPrice} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px]" style={{ color: '#8a8698' }}>
                        {auction.hasBeenBidOn ? 'Current Bid' : 'Minimum Bid'}
                      </p>
                      {auction.hasBeenBidOn ? (
                        <span className="rounded-full px-1.5 py-px text-[9px] font-bold" style={{ backgroundColor: '#fbbf2420', color: '#fbbf24' }}>
                          Has bids
                        </span>
                      ) : (
                        <span className="rounded-full px-1.5 py-px text-[9px] font-bold" style={{ backgroundColor: '#4a485720', color: '#7a7690' }}>
                          No bids yet
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: '#7a7690' }}>No bid information</p>
                )}
              </div>
              {auction.url && (
                <a
                  href={auction.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Bid Now
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Estimated Value — PREMIUM_GATE */}
          {valuation && valuation.sampleSize >= 3 ? (
            <div className="rounded-lg px-4 py-3 mt-2" style={{ backgroundColor: '#1a2a1a', border: '1px solid #2a4a2a' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#5a8a5a' }}>
                    Fair Price
                  </p>
                  <p className="text-lg font-bold" style={{ color: '#4ade80' }}>
                    ~{formatNumber(valuation.estimatedValue)} TC
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px]" style={{ color: '#5a8a5a' }}>Range</p>
                  <p className="text-xs font-semibold" style={{ color: '#8ac08a' }}>
                    {formatNumber(valuation.minPrice)} – {formatNumber(valuation.maxPrice)} TC
                  </p>
                  <p className="text-[8px]" style={{ color: '#4a6a4a' }}>
                    Based on {valuation.sampleSize} similar sales
                  </p>
                </div>
              </div>
            </div>
          ) : !userIsPremium ? (
            <Link
              href="/premium"
              className="flex items-center gap-2 rounded-lg px-4 py-3 mt-2 transition-colors hover:brightness-110"
              style={{ backgroundColor: '#2a2a1a', border: '1px solid #4a4a2a' }}
            >
              <Lock className="h-4 w-4 shrink-0" style={{ color: '#d4a44a' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: '#d4a44a' }}>Fair Price Estimate</p>
                <p className="text-[10px]" style={{ color: '#8a7a4a' }}>Unlock with Premium</p>
              </div>
              <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: '#d4a44a' }} />
            </Link>
          ) : null}
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Transfer Simulator — prominent placement near top */}
          {auction.world && auction.level && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transfer Simulator</p>
              <TransferSimulator
                sourceWorld={auction.world}
                characterLevel={auction.level}
                bidPrice={auction.currentBid ?? auction.minimumBid}
                worldTypes={worldTypes}
              />
            </div>
          )}

          {/* Skills */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {allSkills.map(({ key, value, pct }) => (
                <SkillBox key={key} skillKey={key} value={value} isTrained={value > SKILL_TRAINED_THRESHOLD} pct={pct} />
              ))}
            </div>
          </div>

          {/* Display Items (with tiers) */}
          {auction.displayItems && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Display Items</p>
              <DisplayItemsLarge items={auction.displayItems} />
            </div>
          )}

          {/* Stats */}
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

          {/* Additional Info */}
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

          {auction.creationDate && !auction.creationDate.includes('1969') && (
            <div className="text-[10px] text-muted-foreground/60 text-center pt-1 border-t border-border/20">
              Created: {auction.creationDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auction Card ───────────────────────────────────────────────────────

function StatCell({ icon: Icon, iconColor, label, value }: { icon: React.ElementType; iconColor: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ backgroundColor: '#252333' }}>
      <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: iconColor }} />
      <span className="text-[8px] truncate" style={{ color: '#7a7690' }}>{label}</span>
      <span className="text-[9px] font-bold ml-auto tabular-nums" style={{ color: '#d4d0e0' }}>{value}</span>
    </div>
  );
}

function BoolCell({ icon: Icon, iconColor, label, has }: { icon: React.ElementType; iconColor: string; label: string; has: boolean }) {
  return (
    <div className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ backgroundColor: '#252333' }}>
      <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: has ? iconColor : '#4a4857' }} />
      <span className="text-[8px] truncate" style={{ color: has ? '#d4d0e0' : '#5a5870' }}>{label}</span>
      {has ? (
        <Check className="h-2.5 w-2.5 ml-auto shrink-0" style={{ color: '#4ade80' }} />
      ) : (
        <X className="h-2.5 w-2.5 ml-auto shrink-0" style={{ color: '#4a4857' }} />
      )}
    </div>
  );
}

function GemsCell({ gems }: { gems: string | null }) {
  let count = 0;
  if (gems) {
    try {
      const parsed = JSON.parse(gems) as Array<{ type: string; mods: string[] }>;
      count = parsed.length;
    } catch {
      // leave as 0
    }
  }
  return (
    <div className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ backgroundColor: '#252333' }}>
      <Diamond className="h-2.5 w-2.5 shrink-0" style={{ color: count > 0 ? '#22d3ee' : '#4a4857' }} />
      <span className="text-[8px] truncate" style={{ color: '#7a7690' }}>Gems</span>
      <span className="text-[9px] font-bold ml-auto tabular-nums" style={{ color: count > 0 ? '#22d3ee' : '#5a5870' }}>{count}</span>
    </div>
  );
}

const RUBINOT_BASE = 'https://rubinot.com.br';

function resolveOutfitUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${RUBINOT_BASE}/${url.replace(/^\.\//, '')}`;
}

interface DisplayItem {
  url: string;
  name: string;
  tier: number;
}

function parseDisplayItems(items: string): DisplayItem[] {
  try {
    const parsed = JSON.parse(items);
    if (!Array.isArray(parsed)) return [];
    // New format: array of {url, name, tier} objects
    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].url) {
      return parsed.slice(0, 4);
    }
    // Old format: array of URL strings — backward compatible
    return parsed
      .filter((u: unknown) => typeof u === 'string' && (u as string).startsWith('http'))
      .slice(0, 4)
      .map((url: string) => ({ url, name: '', tier: 0 }));
  } catch {
    return [];
  }
}

const TIER_COLORS = [
  '', // tier 0 = no tier
  '#6ba5e7', // tier 1 — blue
  '#3dcc6e', // tier 2 — green
  '#d4a017', // tier 3 — gold
  '#c44dff', // tier 4 — purple
  '#ff4444', // tier 5 — red
];

function DisplayItems({ items }: { items: string }) {
  const displayItems = parseDisplayItems(items);
  const slots = Array.from({ length: 4 }, (_, i) => displayItems[i] || null);
  return (
    <div className="grid grid-cols-4 gap-1">
      {slots.map((item, i) => (
        <div
          key={i}
          className="relative h-8 rounded flex items-center justify-center group"
          style={{
            backgroundColor: '#252333',
            border: item?.tier ? `1px solid ${TIER_COLORS[item.tier] || TIER_COLORS[1]}` : '1px solid #3a3848',
          }}
          title={item?.name ? `${item.name}${item.tier ? ` (T${item.tier})` : ''}` : undefined}
        >
          {item?.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.url} alt={item.name || ''} className="w-6 h-6 object-contain" loading="lazy" />
          )}
          {item?.tier > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[9px] font-bold leading-none text-white shadow-sm"
              style={{ backgroundColor: TIER_COLORS[item.tier] || TIER_COLORS[1] }}
            >
              {item.tier}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DisplayItemsLarge({ items }: { items: string }) {
  const displayItems = parseDisplayItems(items);
  if (displayItems.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2">
      {displayItems.map((item, i) => (
        <div
          key={i}
          className="relative flex flex-col items-center gap-1 rounded-lg p-2"
          style={{
            backgroundColor: '#252333',
            border: item.tier ? `1px solid ${TIER_COLORS[item.tier] || TIER_COLORS[1]}` : '1px solid #3a3848',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.name || ''} className="w-10 h-10 object-contain" loading="lazy" />
          {item.tier > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[10px] font-bold leading-none text-white shadow-sm"
              style={{ backgroundColor: TIER_COLORS[item.tier] || TIER_COLORS[1] }}
            >
              {item.tier}
            </span>
          )}
          {item.name && (
            <p className="text-[9px] text-muted-foreground/70 text-center leading-tight truncate w-full" title={item.name}>
              {item.name}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function getTopAuctionHighlight(auction: SerializedCurrentAuction): { label: string; reason: string; color: string } | null {
  const level = auction.level || 0;
  const mainSkill = Math.max(
    auction.magicLevel || 0,
    auction.sword || 0,
    auction.axe || 0,
    auction.club || 0,
    auction.distance || 0,
    auction.fist || 0,
  );
  const storeItems = auction.storeItemsCount || 0;

  // Multiple criteria met = top auction
  const criteria: string[] = [];
  if (level >= 1200) criteria.push('High Level');
  if (mainSkill >= 120) criteria.push('High Skills');
  if (storeItems >= 50) criteria.push('Store Items');

  if (criteria.length >= 2) return { label: 'Top Auction', reason: criteria.join(' · '), color: '#f59e0b' };
  if (level >= 1200) return { label: 'Top Auction', reason: 'Level ' + level, color: '#f59e0b' };
  if (mainSkill >= 130) return { label: 'Top Auction', reason: 'Skill ' + mainSkill, color: '#a78bfa' };
  if (storeItems >= 100) return { label: 'Top Auction', reason: storeItems + ' Store Items', color: '#60a5fa' };
  return null;
}

function CurrentAuctionCard({
  auction,
  worldTypes,
  valuation,
  onDetails,
  tick,
  userIsPremium = false,
  canFeature = false,
  onFeature,
}: {
  auction: SerializedCurrentAuction;
  worldTypes: WorldTypeInfo[];
  valuation?: ValuationData;
  onDetails: (auction: SerializedCurrentAuction) => void;
  tick: number;
  userIsPremium?: boolean;
  canFeature?: boolean;
  onFeature?: (externalId: string) => void;
}) {
  // tick forces re-render for live countdown
  void tick;
  const allSkills = getAllSkills(auction);
  const tags = getCharacterTags(auction);
  const bidPrice = auction.currentBid ?? auction.minimumBid;
  const ended = isAuctionEnded(auction.auctionEnd);
  const hasAuctionEnd = parseAuctionDate(auction.auctionEnd) !== null;

  // Top auction highlight based on skills, level, store items
  const topHighlight = getTopAuctionHighlight(auction);

  // Card border style based on top auction status
  const cardBorderStyle = useMemo(() => {
    if (topHighlight) {
      return {
        backgroundColor: '#302e3a',
        border: `2px solid ${topHighlight.color}50`,
        boxShadow: `0 0 20px ${topHighlight.color}15, 0 0 40px ${topHighlight.color}08`,
      };
    }
    return { backgroundColor: '#302e3a', border: '1px solid #4a4857' };
  }, [topHighlight]);

  return (
    <Card className="transition-all hover:shadow-xl hover:shadow-black/20 group flex flex-col" style={cardBorderStyle}>
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Header — outfit image + name + level/vocation + bid badge */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            {auction.outfitImageUrl && (
              <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#252333' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveOutfitUrl(auction.outfitImageUrl)}
                  alt={auction.characterName}
                  className="w-14 h-14 object-contain"
                  loading="lazy"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate" style={{ color: '#4ade80' }}>
                      {auction.characterName}
                    </span>
                    {auction.url && (
                      <a href={auction.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: '#8a8698' }}>
                    Level {auction.level || '?'} · {auction.vocation || 'Unknown'} · {auction.world || '?'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {auction.hasBeenBidOn ? (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: '#fbbf2420', color: '#fbbf24' }}>
                      Bid
                    </span>
                  ) : (
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: '#4a485720', color: '#7a7690' }}>
                      No bid
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Auction badge */}
        {topHighlight && (
          <div className="px-4 pb-2">
            <div
              className="flex items-center gap-1.5 rounded-md px-3 py-2"
              style={{ backgroundColor: `${topHighlight.color}10`, border: `1px solid ${topHighlight.color}25` }}
            >
              <Crown className="h-3.5 w-3.5" style={{ color: topHighlight.color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: topHighlight.color }}>
                {topHighlight.label}
              </span>
              <span className="text-[10px] ml-auto" style={{ color: `${topHighlight.color}90` }}>
                {topHighlight.reason}
              </span>
            </div>
          </div>
        )}

        {/* Auction timer bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between rounded-md px-3 py-2.5" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: ended ? '#f87171' : '#fbbf24' }} />
              {hasAuctionEnd && !ended ? (
                <div>
                  <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>{formatAuctionEnd(auction.auctionEnd)}</span>
                  {auction.auctionEnd && (
                    <span className="text-[9px] ml-1.5" style={{ color: '#7a7690' }}>
                      {auction.auctionEnd.replace(/\s+[A-Z]{2,4}$/, '')}
                    </span>
                  )}
                </div>
              ) : ended ? (
                <span className="text-xs font-bold" style={{ color: '#f87171' }}>Ended</span>
              ) : (
                <span className="text-xs font-bold" style={{ color: '#4ade80' }}>Active</span>
              )}
            </div>
            {bidPrice != null && bidPrice > 0 && (
              <div className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" style={{ color: auction.hasBeenBidOn ? '#fbbf24' : '#4ade80' }} />
                <span className="text-xs font-bold" style={{ color: auction.hasBeenBidOn ? '#fbbf24' : '#4ade80' }}>
                  {formatNumber(bidPrice)}
                </span>
                <PriceTooltip coins={bidPrice} />
              </div>
            )}
          </div>
        </div>

        {/* Fair Price */}
        {valuation && valuation.sampleSize >= 3 ? (
          <div className="px-4 pb-3">
            <div
              className="flex items-center gap-1.5 rounded-md px-2.5 py-2"
              style={{ backgroundColor: '#1a2a1a', border: '1px solid #2a4a2a' }}
              title={`Range: ${formatNumber(valuation.minPrice)} – ${formatNumber(valuation.maxPrice)} TC (${valuation.sampleSize} sales)`}
            >
              <span className="text-[9px] font-medium shrink-0" style={{ color: '#5a8a5a' }}>Similar characters sold for</span>
              <span className="text-xs font-bold ml-auto" style={{ color: '#4ade80' }}>~{formatNumber(valuation.estimatedValue)} TC</span>
            </div>
          </div>
        ) : !userIsPremium ? (
          <div className="px-4 pb-3">
            <Link
              href="/premium"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-2 transition-colors hover:brightness-110"
              style={{ backgroundColor: '#2a2a1a', border: '1px solid #4a4a2a' }}
            >
              <Lock className="h-3 w-3 shrink-0" style={{ color: '#d4a44a' }} />
              <span className="text-[9px] font-medium shrink-0" style={{ color: '#d4a44a' }}>Fair Price Estimate</span>
              <span className="text-[9px] ml-auto" style={{ color: '#8a7a4a' }}>Premium</span>
            </Link>
          </div>
        ) : null}

        {/* World Transfer Fee Calculator */}
        {auction.world && auction.level && (
          <div className="px-4 pb-3">
            <TransferSimulator
              sourceWorld={auction.world}
              characterLevel={auction.level}
              bidPrice={auction.currentBid ?? auction.minimumBid}
              worldTypes={worldTypes}
            />
          </div>
        )}

        {/* Display Items */}
        <div className="px-4 pb-3">
          <DisplayItems items={auction.displayItems || '[]'} />
        </div>

        {/* Skills */}
        {allSkills.length > 0 && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {allSkills.map(({ key, value, pct }) => (
                <SkillBox key={key} skillKey={key} value={value} isTrained={value > SKILL_TRAINED_THRESHOLD} pct={pct} />
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1.5">
            <StatCell icon={Sparkles} iconColor="#a78bfa" label="Charms" value={formatNumber(auction.charmPoints || 0)} />
            <StatCell icon={Skull} iconColor="#f87171" label="Boss" value={formatNumber(auction.bossPoints || 0)} />
            <StatCell icon={Star} iconColor="#ec4899" label="Outfits" value={String(auction.outfitsCount || 0)} />
            <StatCell icon={Footprints} iconColor="#06b6d4" label="Mounts" value={String(auction.mountsCount || 0)} />
            <BoolCell icon={Package} iconColor="#f59e0b" label="Loot Pouch" has={!!auction.hasLootPouch} />
            <BoolCell icon={Gem} iconColor="#a78bfa" label="Charm Exp" has={!!auction.charmExpansion} />
            <BoolCell icon={Target} iconColor="#60a5fa" label="Extra Prey Slot" has={(auction.preySlots || 0) >= 3} />
            <BoolCell icon={CalendarCheck} iconColor="#10b981" label="Weekly Task" has={!!auction.weeklyTaskExpansion} />
            <BoolCell icon={Trophy} iconColor="#f59e0b" label="Battle Pass" has={!!auction.battlePassDeluxe} />
            <StatCell icon={Users} iconColor="#4ade80" label="Hirelings" value={String(auction.hirelings || 0)} />
            <GemsCell gems={auction.gems} />
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full px-2.5 py-0.5 text-[9px] font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="rounded-full px-2.5 py-0.5 text-[9px] font-medium" style={{ backgroundColor: '#3a3848', color: '#8a8698' }}>
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View Details + Feature CTA */}
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDetails(auction); }}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-md px-3 py-2.5 text-xs font-semibold transition-colors"
            style={{ backgroundColor: '#3b2e6e', border: '1px solid #5b4e9e', color: '#c4b5fd' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4c3d8f'; e.currentTarget.style.color = '#ddd6fe'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3b2e6e'; e.currentTarget.style.color = '#c4b5fd'; }}
          >
            <Eye className="h-3.5 w-3.5" />
            View Details
          </button>
          {canFeature && onFeature && (
            <button
              onClick={(e) => { e.stopPropagation(); onFeature(auction.externalId); }}
              className="flex items-center justify-center gap-1 rounded-md px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{ backgroundColor: '#3a3a0a', border: '1px solid #6a6a1a', color: '#fbbf24' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4a1a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3a3a0a'; }}
              title="Feature this auction"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Client Component ──────────────────────────────────────────────

export function CurrentAuctionsClient({
  initialAuctions,
  worlds,
  vocations,
  worldTypes,
  valuations,
  initialSearch = '',
  userIsPremium = false,
  userId = null,
  featuredAuctionIds = [],
}: CurrentAuctionsClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedWorld, setSelectedWorld] = useState('');
  const [selectedVocation, setSelectedVocation] = useState('');
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [minLevel, setMinLevel] = useState('');
  const [maxLevel, setMaxLevel] = useState('');
  const [sortField, setSortField] = useState<SortField>('auctionEnd');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);
  const [hideEnded, setHideEnded] = useState(true);
  const [detailAuction, setDetailAuction] = useState<SerializedCurrentAuction | null>(null);
  const [featuredIds, setFeaturedIds] = useState(featuredAuctionIds);
  const [featuringAuction, setFeaturingAuction] = useState(false);
  const tick = useCountdown();

  // Build a set of featured external IDs for quick lookup
  const featuredExternalIds = useMemo(() => new Set(featuredIds.map((f) => f.auctionExternalId)), [featuredIds]);

  // Get the featured auction data by matching external IDs to auction list
  const featuredAuctions = useMemo(
    () => initialAuctions.filter((a) => featuredExternalIds.has(a.externalId)),
    [initialAuctions, featuredExternalIds]
  );

  // Check if current user already has an active featured auction
  const userHasFeatured = useMemo(
    () => userId ? featuredIds.some((f) => f.userId === userId) : false,
    [featuredIds, userId]
  );

  async function featureAuction(externalId: string) {
    if (!userIsPremium || userHasFeatured || featuringAuction) return;
    setFeaturingAuction(true);
    try {
      const res = await fetch('/api/featured-auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId: externalId }),
      });
      const data = await res.json();
      if (data.success) {
        setFeaturedIds((prev) => [
          ...prev,
          {
            auctionExternalId: externalId,
            featuredId: data.data.id,
            userName: null,
            userImage: null,
            userId: userId!,
          },
        ]);
      }
    } finally {
      setFeaturingAuction(false);
    }
  }

  async function unfeatureAuction(featuredId: number) {
    const res = await fetch(`/api/featured-auctions/${featuredId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      setFeaturedIds((prev) => prev.filter((f) => f.featuredId !== featuredId));
    }
  }

  const filtered = useMemo(() => {
    let result = initialAuctions;

    // Filter ended auctions unless explicitly showing them
    if (hideEnded) {
      result = result.filter((a) => !isAuctionEnded(a.auctionEnd));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.characterName.toLowerCase().includes(q));
    }
    if (selectedWorld) result = result.filter((a) => a.world === selectedWorld);
    if (selectedVocation) {
      const vocGroup: Record<string, string[]> = {
        'Elite Knight': ['Knight', 'Elite Knight'],
        'Master Sorcerer': ['Sorcerer', 'Master Sorcerer'],
        'Elder Druid': ['Druid', 'Elder Druid'],
        'Royal Paladin': ['Paladin', 'Royal Paladin'],
        'Exalted Monk': ['Monk', 'Exalted Monk'],
      };
      const matches = vocGroup[selectedVocation] || [selectedVocation];
      result = result.filter((a) => matches.includes(a.vocation || ''));
    }
    if (showTopOnly) result = result.filter((a) => getTopAuctionHighlight(a) !== null);
    if (minLevel) result = result.filter((a) => (a.level || 0) >= parseInt(minLevel));
    if (maxLevel) result = result.filter((a) => (a.level || 0) <= parseInt(maxLevel));

    result.sort((a, b) => {
      if (sortField === 'auctionEnd') {
        // Parse auction end dates for chronological sorting
        const parseEnd = (s: string | null) => {
          if (!s) return Infinity;
          const d = new Date(s.replace(/\s+[A-Z]{2,5}$/, ''));
          return isNaN(d.getTime()) ? Infinity : d.getTime();
        };
        const aVal = parseEnd(a.auctionEnd);
        const bVal = parseEnd(b.auctionEnd);
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const getVal = (auction: SerializedCurrentAuction) => {
        if (sortField === 'currentBid') return auction.currentBid ?? auction.minimumBid ?? 0;
        if (sortField === 'minimumBid') return auction.minimumBid ?? 0;
        return auction[sortField] || 0;
      };
      const aVal = getVal(a);
      const bVal = getVal(b);
      return sortOrder === 'desc' ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal);
    });

    return result;
  }, [initialAuctions, search, selectedWorld, selectedVocation, showTopOnly, minLevel, maxLevel, sortField, sortOrder, hideEnded]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const clearFilters = () => {
    setSearch('');
    setSelectedWorld('');
    setSelectedVocation('');
    setShowTopOnly(false);
    setMinLevel('');
    setMaxLevel('');
    setPage(1);
  };

  const hasActiveFilters = search || selectedWorld || selectedVocation || showTopOnly || minLevel || maxLevel;

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
      {/* Featured Auctions Section */}
      {featuredAuctions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4" style={{ color: '#fbbf24' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Featured Auctions</h2>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {featuredAuctions.map((auction) => {
              const info = featuredIds.find((f) => f.auctionExternalId === auction.externalId);
              const isOwn = userId && info?.userId === userId;
              return (
                <div key={`featured-${auction.id}`} className="relative">
                  <div
                    className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{ backgroundColor: '#4a3a0a', border: '1px solid #8a6a1a' }}
                  >
                    <Star className="h-3 w-3" style={{ color: '#fbbf24' }} />
                    <span className="text-[9px] font-semibold" style={{ color: '#fbbf24' }}>Featured</span>
                  </div>
                  <div style={{ border: '2px solid #8a6a1a40', borderRadius: '0.75rem' }}>
                    <CurrentAuctionCard
                      auction={auction}
                      worldTypes={worldTypes}
                      valuation={valuations[auction.id]}
                      onDetails={setDetailAuction}
                      tick={tick}
                      userIsPremium={userIsPremium}
                    />
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => info && unfeatureAuction(info.featuredId)}
                      className="absolute top-2 right-2 z-10 rounded-full p-1 transition-colors"
                      style={{ backgroundColor: '#4a2a2a', border: '1px solid #8a4a4a' }}
                      title="Remove featured"
                    >
                      <X className="h-3 w-3" style={{ color: '#f87171' }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar — always visible */}
      <div className="space-y-3">
        {/* Row 1: Search + World + Level Range + Clear */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by character name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-border/50 bg-secondary/50 pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* World dropdown — Radix Select */}
            <Select value={selectedWorld || '__all__'} onValueChange={(v) => { setSelectedWorld(v === '__all__' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[160px] bg-secondary/50 border-border/50 text-sm">
                <Globe className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="All Worlds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Worlds</SelectItem>
                {worlds.sort().map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Level range */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Lvl</span>
              <input
                type="number"
                placeholder="Min"
                value={minLevel}
                onChange={(e) => { setMinLevel(e.target.value); setPage(1); }}
                className="h-9 w-[70px] rounded-md border border-border/50 bg-secondary/50 px-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="number"
                placeholder="Max"
                value={maxLevel}
                onChange={(e) => { setMaxLevel(e.target.value); setPage(1); }}
                className="h-9 w-[70px] rounded-md border border-border/50 bg-secondary/50 px-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex h-9 items-center gap-1 rounded-md border border-border/50 bg-secondary/50 px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Vocation chips (grouped) + Top Auctions */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Elite Knight', color: getVocationColor('Elite Knight') },
            { label: 'Master Sorcerer', color: getVocationColor('Master Sorcerer') },
            { label: 'Elder Druid', color: getVocationColor('Elder Druid') },
            { label: 'Royal Paladin', color: getVocationColor('Royal Paladin') },
            { label: 'Exalted Monk', color: getVocationColor('Exalted Monk') },
          ].map((v) => (
            <button
              key={v.label}
              onClick={() => { setSelectedVocation(selectedVocation === v.label ? '' : v.label); setPage(1); }}
              className={`flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-medium transition-colors ${
                selectedVocation === v.label
                  ? 'text-white shadow-sm'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              style={selectedVocation === v.label ? { backgroundColor: v.color } : undefined}
            >
              <Shield className="h-3 w-3" />
              {v.label}
            </button>
          ))}
          <div className="h-5 w-px bg-border/50 mx-0.5 self-center" />
          <button
            onClick={() => { setShowTopOnly(!showTopOnly); setPage(1); }}
            className={`flex h-7 items-center gap-1 rounded-full px-3 text-[11px] font-medium transition-colors ${
              showTopOnly
                ? 'text-white shadow-sm'
                : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            style={showTopOnly ? { backgroundColor: '#f59e0b' } : undefined}
          >
            <Crown className="h-3 w-3" />
            Top Auctions
          </button>
        </div>
      </div>

      {/* Sort Bar + Count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {filtered.length} auction{filtered.length !== 1 ? 's' : ''}
          {!hideEnded && <span className="text-muted-foreground/60"> (including ended)</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['auctionEnd', 'Ending'],
            ['currentBid', 'Bid'],
            ['level', 'Level'],
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
          <div className="h-5 w-px bg-border/50 mx-1" />
          <button
            onClick={() => { setHideEnded(!hideEnded); setPage(1); }}
            className={`flex h-8 items-center gap-1 rounded-md px-3 text-xs transition-colors ${!hideEnded ? 'bg-amber-500/10 text-amber-400' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
          >
            <Eye className="h-3 w-3" />
            {hideEnded ? 'Show Ended' : 'Hide Ended'}
          </button>
        </div>
      </div>

      {/* Auction Card Grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {paginated.map((auction) => (
          <CurrentAuctionCard
            key={auction.id}
            auction={auction}
            worldTypes={worldTypes}
            valuation={valuations[auction.id]}
            onDetails={setDetailAuction}
            tick={tick}
            userIsPremium={userIsPremium}
            canFeature={userIsPremium && !userHasFeatured && !featuredExternalIds.has(auction.externalId) && !isAuctionEnded(auction.auctionEnd)}
            onFeature={featureAuction}
          />
        ))}
      </div>

      {/* Detail Modal */}
      {detailAuction && (
        <AuctionDetailModal auction={detailAuction} worldTypes={worldTypes} valuation={valuations[detailAuction.id]} onClose={() => setDetailAuction(null)} userIsPremium={userIsPremium} />
      )}

      {/* Empty State */}
      {paginated.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">No current auctions found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or check back later</p>
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
