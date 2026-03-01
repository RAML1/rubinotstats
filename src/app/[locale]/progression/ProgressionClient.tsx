'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown, Minus, Search, Trophy, Zap, Calendar, Star, X, GitCompareArrows } from 'lucide-react';
import { formatExp, getVocationColor } from '@/lib/utils/formatters';
import { trackSearch } from '@/components/analytics/AnalyticsTracker';
import { format } from 'date-fns';
import ExpChart from './components/ExpChart';
import SkillChart from './components/SkillChart';
import TrainingHeatmap from './components/TrainingHeatmap';
import SkillGrid from './components/SkillGrid';
import { VocationComparison } from './components/VocationComparison';
import MilestonesFeed from './components/MilestonesFeed';
import { SessionCalculator } from './components/SessionCalculator';
import WorldLeaders from './components/WorldLeaders';
import CompareView from './components/CompareView';
import ValuationCard from './components/ValuationCard';

interface SearchResult {
  name: string;
  world: string;
  vocation: string;
}

// Matches the API response from /api/progression
interface APIResponse {
  success: boolean;
  data: {
    character: {
      id: number;
      name: string;
      vocation: string | null;
      world: { name: string };
    };
    snapshots: Array<{
      capturedDate: string;
      level: number | null;
      experience: number | null;
      magicLevel: number | null;
      fist: number | null;
      club: number | null;
      sword: number | null;
      axe: number | null;
      distance: number | null;
      shielding: number | null;
      fishing: number | null;
      charmPoints: number | null;
      bountyPoints: number | null;
      bountyRank: number | null;
      expRank: number | null;
      mlRank: number | null;
      fistRank: number | null;
      clubRank: number | null;
      swordRank: number | null;
      axeRank: number | null;
      distanceRank: number | null;
      shieldingRank: number | null;
      fishingRank: number | null;
      charmRank: number | null;
      expGained: number | null;
      levelsGained: number | null;
    }>;
    highscores: any[];
    vocationAverages: {
      vocation: string;
      levelRange?: string;
      avgLevel: number | null;
      avgMagicLevel: number | null;
      avgFist: number | null;
      avgClub: number | null;
      avgSword: number | null;
      avgAxe: number | null;
      avgDistance: number | null;
      avgShielding: number | null;
      avgFishing: number | null;
    } | null;
    kpis: {
      currentLevel: number;
      expGainedThisMonth: number;
      expGainedLastMonth: number;
      levelsGainedThisMonth: number;
      levelsGainedLastMonth: number;
      skillChangesThisMonth: Array<{ skill: string; oldValue: number; newValue: number; change: number }>;
      bestDayEver: { date: string | null; expGained: number };
      bestWeekEver: { startDate: string | null; endDate: string | null; expGained: number };
      currentExpRank: number | null;
      currentMlRank: number | null;
    };
    skillRanks: {
      experience: number | null;
      magicLevel: number | null;
      fist: number | null;
      club: number | null;
      sword: number | null;
      axe: number | null;
      distance: number | null;
      shielding: number | null;
      fishing: number | null;
      charmPoints: number | null;
      bountyPoints: number | null;
    } | null;
    milestones: Array<{
      type: 'level' | 'skill' | 'rank';
      description: string;
      date: string;
      value: number;
      skill?: string;
      category?: string;
    }>;
    estimatedExp?: boolean;
  };
}

// Map skill field names to human-readable labels
const SKILL_LABELS: Record<string, string> = {
  magicLevel: 'ML',
  fist: 'Fist',
  club: 'Club',
  sword: 'Sword',
  axe: 'Axe',
  distance: 'Dist',
  shielding: 'Shield',
  fishing: 'Fish',
};

// Saved characters localStorage helpers
interface SavedCharacter {
  name: string;
  world: string;
  vocation: string;
}

const SAVED_KEY = 'rs_saved_characters';
const MAX_SAVED = 20;

function loadSaved(): SavedCharacter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(chars: SavedCharacter[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(chars.slice(0, MAX_SAVED)));
}

export default function ProgressionClient() {
  const searchParams = useSearchParams();
  const t = useTranslations('progression');
  const tc = useTranslations('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [data, setData] = useState<APIResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Compare feature state
  const [compareQuery, setCompareQuery] = useState('');
  const [compareResults, setCompareResults] = useState<SearchResult[]>([]);
  const [compareData, setCompareData] = useState<APIResponse['data'] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareSearchLoading, setCompareSearchLoading] = useState(false);
  const [showCompareDropdown, setShowCompareDropdown] = useState(false);
  const [showCompareSearch, setShowCompareSearch] = useState(false);
  const compareTimeout = useRef<NodeJS.Timeout>(null);
  const compareDropdownRef = useRef<HTMLDivElement>(null);

  // Saved characters state
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);

  useEffect(() => {
    setSavedCharacters(loadSaved());
  }, []);

  const isSaved = data
    ? savedCharacters.some((c) => c.name.toLowerCase() === data.character.name.toLowerCase())
    : false;

  const toggleSave = useCallback(() => {
    if (!data) return;
    setSavedCharacters((prev) => {
      const exists = prev.some((c) => c.name.toLowerCase() === data.character.name.toLowerCase());
      const next = exists
        ? prev.filter((c) => c.name.toLowerCase() !== data.character.name.toLowerCase())
        : [...prev, { name: data.character.name, world: data.character.world.name, vocation: data.character.vocation || 'None' }];
      persistSaved(next);
      return next;
    });
  }, [data]);

  const removeSaved = useCallback((name: string) => {
    setSavedCharacters((prev) => {
      const next = prev.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
      persistSaved(next);
      return next;
    });
  }, []);

  const selectCharacter = useCallback(async (characterName: string) => {
    trackSearch(characterName, '/progression');
    setSelectedCharacter(characterName);
    setSearchQuery(characterName);
    setShowDropdown(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/progression?characterName=${encodeURIComponent(characterName)}`);
      if (res.ok) {
        const json: APIResponse = await res.json();
        if (json.success) {
          setData(json.data);
        }
      }
    } catch (error) {
      console.error('Error fetching progression data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCompareCharacter = useCallback(async (characterName: string) => {
    setCompareQuery(characterName);
    setShowCompareDropdown(false);
    setCompareLoading(true);

    try {
      const res = await fetch(`/api/progression?characterName=${encodeURIComponent(characterName)}`);
      if (res.ok) {
        const json: APIResponse = await res.json();
        if (json.success) {
          setCompareData(json.data);
        }
      }
    } catch (error) {
      console.error('Error fetching compare data:', error);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  const clearCompare = useCallback(() => {
    setCompareData(null);
    setCompareQuery('');
    setShowCompareSearch(false);
  }, []);

  // Auto-load character from URL search params (e.g. ?character=Super+Bonk+Lee)
  useEffect(() => {
    const charParam = searchParams.get('character');
    if (charParam && !initialLoadDone.current) {
      initialLoadDone.current = true;
      selectCharacter(charParam);
    }
  }, [searchParams, selectCharacter]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // Don't re-search when query matches the already-selected character
    if (selectedCharacter && searchQuery.toLowerCase() === selectedCharacter.toLowerCase()) {
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/progression?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery, selectedCharacter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced compare search
  useEffect(() => {
    if (compareQuery.length < 2) {
      setCompareResults([]);
      setShowCompareDropdown(false);
      return;
    }

    if (compareData && compareQuery.toLowerCase() === compareData.character.name.toLowerCase()) {
      return;
    }

    if (compareTimeout.current) {
      clearTimeout(compareTimeout.current);
    }

    compareTimeout.current = setTimeout(async () => {
      setCompareSearchLoading(true);
      try {
        const res = await fetch(`/api/progression?q=${encodeURIComponent(compareQuery)}`);
        if (res.ok) {
          const json = await res.json();
          setCompareResults((json.data || []).filter((r: SearchResult) => r.name !== selectedCharacter));
          setShowCompareDropdown(true);
        }
      } catch (error) {
        console.error('Compare search failed:', error);
      } finally {
        setCompareSearchLoading(false);
      }
    }, 300);

    return () => {
      if (compareTimeout.current) {
        clearTimeout(compareTimeout.current);
      }
    };
  }, [compareQuery, compareData, selectedCharacter]);

  // Close compare dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (compareDropdownRef.current && !compareDropdownRef.current.contains(event.target as Node)) {
        setShowCompareDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive computed values from API data
  const computed = useMemo(() => {
    if (!data) return null;

    const { kpis, snapshots } = data;
    // EXP change percent
    const expChangePercent = kpis.expGainedLastMonth > 0
      ? ((kpis.expGainedThisMonth - kpis.expGainedLastMonth) / kpis.expGainedLastMonth) * 100
      : 0;

    // Level change direction — positive gains = green
    const levelsDir = kpis.levelsGainedThisMonth > 0 ? 'up' as const
      : kpis.levelsGainedThisMonth < 0 ? 'down' as const
      : 'neutral' as const;

    // Avg daily/weekly exp
    const totalExp = snapshots.reduce((sum, s) => sum + (s.expGained || 0), 0);
    const avgDailyExp = snapshots.length > 0 ? totalExp / snapshots.length : 0;
    const avgWeeklyExp = avgDailyExp * 7;

    return {
      expChangePercent,
      levelsDir,
      avgDailyExp,
      avgWeeklyExp,
    };
  }, [data]);

  // Get latest non-null skill values across all snapshots (skills aren't captured daily)
  const latestSkills = useMemo(() => {
    if (!data || data.snapshots.length === 0) return null;
    const skillKeys = ['magicLevel', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'] as const;
    const result: Record<string, number | null> = {};
    for (const key of skillKeys) {
      // Walk backwards to find the latest non-null value
      for (let i = data.snapshots.length - 1; i >= 0; i--) {
        const val = data.snapshots[i][key];
        if (val !== null && val !== undefined) {
          result[key] = val;
          break;
        }
      }
      if (!(key in result)) result[key] = null;
    }
    return result as {
      magicLevel: number | null; fist: number | null; club: number | null;
      sword: number | null; axe: number | null; distance: number | null;
      shielding: number | null; fishing: number | null;
    };
  }, [data]);

  // Get earliest skill values for change comparison
  const earliestSkills = useMemo(() => {
    if (!data || data.snapshots.length === 0) return null;
    const skillKeys = ['magicLevel', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'] as const;
    const result: Record<string, number | null> = {};
    for (const key of skillKeys) {
      for (let i = 0; i < data.snapshots.length; i++) {
        const val = data.snapshots[i][key];
        if (val !== null && val !== undefined) {
          result[key] = val;
          break;
        }
      }
      if (!(key in result)) result[key] = null;
    }
    return result as {
      magicLevel: number | null; fist: number | null; club: number | null;
      sword: number | null; axe: number | null; distance: number | null;
      shielding: number | null; fishing: number | null;
    };
  }, [data]);

  const renderTrendIcon = (direction: 'up' | 'down' | 'neutral', size = 16) => {
    if (direction === 'up') return <TrendingUp size={size} className="text-emerald-400" />;
    if (direction === 'down') return <TrendingDown size={size} className="text-red-400" />;
    return <Minus size={size} className="text-muted-foreground" />;
  };

  return (
    <div className="space-y-8">
      {/* Search Bar — hero when no character loaded, compact when loaded */}
      {!data && !loading ? (
        <div className="flex flex-col items-center">
          {/* Hero search card */}
          <div className="relative z-20 w-full max-w-xl">
            {/* Ambient glow behind the card */}
            <div
              className="absolute -inset-1 rounded-2xl opacity-60 blur-lg"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(217,119,6,0.15), rgba(245,158,11,0.3))' }}
            />
            <div
              className="relative rounded-2xl border p-6 backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(15,20,32,0.8))',
                borderColor: 'rgba(245,158,11,0.25)',
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <Search size={18} className="text-amber-400" />
                <p className="text-sm font-medium text-amber-200/90">
                  {t('searchDescription')}
                </p>
              </div>

              {/* Search input with glow ring */}
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400/70" size={22} />
                  <Input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-14 pl-12 pr-4 text-base rounded-xl bg-card/60 border-amber-500/30 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    </div>
                  )}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div
                    className="absolute z-50 mt-2 w-full rounded-xl border border-amber-500/20 shadow-2xl p-2"
                    style={{ backgroundColor: '#0f1420' }}
                  >
                    {searchResults.map((result) => (
                      <button
                        key={`${result.name}-${result.world}`}
                        onClick={() => selectCharacter(result.name)}
                        className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-amber-500/10 transition-colors"
                      >
                        <div className="font-medium">{result.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.vocation} &bull; {result.world}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground/50 mt-3 text-center">
                {t('dataUpdatedNote')}
              </p>

              {/* Saved Characters */}
              {savedCharacters.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(245,158,11,0.12)' }}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('saved.heading')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedCharacters.map((char) => (
                      <button
                        key={char.name}
                        onClick={() => selectCharacter(char.name)}
                        className="group flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-amber-500/15"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: getVocationColor(char.vocation) }}
                        />
                        <span className="truncate max-w-[120px]">{char.name}</span>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSaved(char.name);
                          }}
                          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                          <X size={12} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {savedCharacters.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground/40 text-center">{t('saved.empty')}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Compact search when character is loaded */
        <div className="flex flex-col items-start">
          <div className="relative w-full max-w-md" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-border/50 backdrop-blur"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <Card className="absolute z-50 mt-2 w-full border-border/50 bg-card/95 backdrop-blur-xl shadow-xl">
                <CardContent className="p-2">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.name}-${result.world}`}
                      onClick={() => selectCharacter(result.name)}
                      className="w-full rounded-md px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.vocation} &bull; {result.world}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Saved Characters Chips */}
          {savedCharacters.length > 0 && (
            <div className="mt-3 w-full max-w-md">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('saved.heading')}</p>
              <div className="flex flex-wrap gap-1.5">
                {savedCharacters.map((char) => (
                  <button
                    key={char.name}
                    onClick={() => selectCharacter(char.name)}
                    className="group flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent/50"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: getVocationColor(char.vocation) }}
                    />
                    <span className="truncate max-w-[120px]">{char.name}</span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSaved(char.name);
                      }}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Main Content */}
      {!loading && data && computed && (
        <>
          {/* Character Header */}
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{data.character.name}</h2>
            {data.character.vocation && (
              <Badge variant="secondary" className="text-sm">
                {data.character.vocation}
              </Badge>
            )}
            <button
              onClick={toggleSave}
              title={isSaved ? t('saved.unsave') : t('saved.save')}
              className="transition-colors hover:scale-110 active:scale-95"
            >
              <Star
                size={20}
                className={isSaved ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground hover:text-amber-400'}
              />
            </button>
            <div className="ml-auto flex items-center gap-2">
              {!showCompareSearch && !compareData && (
                <button
                  onClick={() => setShowCompareSearch(true)}
                  className="flex items-center gap-1.5 rounded-full bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <GitCompareArrows size={14} />
                  {t('compareButton')}
                </button>
              )}
              {(showCompareSearch || compareData) && !compareLoading && (
                <button
                  onClick={clearCompare}
                  className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <X size={14} />
                  {compareData ? t('removeComparison') : tc('cancel')}
                </button>
              )}
            </div>
          </div>

          {/* Compare Search */}
          {showCompareSearch && !compareData && (
            <div className="relative max-w-sm" ref={compareDropdownRef}>
              <div className="relative">
                <GitCompareArrows className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
                <Input
                  type="text"
                  placeholder={t('comparePlaceholder')}
                  value={compareQuery}
                  onChange={(e) => setCompareQuery(e.target.value)}
                  className="pl-9 bg-card/50 border-amber-500/30 backdrop-blur text-sm"
                  autoFocus
                />
                {compareSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                  </div>
                )}
              </div>
              {showCompareDropdown && compareResults.length > 0 && (
                <Card className="absolute z-50 mt-2 w-full border-border/50 bg-card/95 backdrop-blur-xl shadow-xl">
                  <CardContent className="p-2">
                    {compareResults.map((result) => (
                      <button
                        key={`${result.name}-${result.world}`}
                        onClick={() => selectCompareCharacter(result.name)}
                        className="w-full rounded-md px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                      >
                        <div className="font-medium text-sm">{result.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.vocation} &bull; {result.world}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {compareLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              {t('loadingComparison')}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Trophy size={16} className="text-primary" />
                  {t('kpis.currentLevel')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.kpis.currentLevel}</div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  {renderTrendIcon(computed.levelsDir, 14)}
                  <span className={computed.levelsDir === 'up' ? 'text-emerald-400' : computed.levelsDir === 'down' ? 'text-red-400' : 'text-muted-foreground'}>
                    {data.kpis.levelsGainedThisMonth > 0 ? '+' : ''}{data.kpis.levelsGainedThisMonth} {t('kpis.thisMonth')}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Zap size={16} className="text-primary" />
                  {t('kpis.expThisMonth')}
                  {data.estimatedExp && (
                    <span className="ml-auto text-[10px] font-normal text-amber-400/70">~est.</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.estimatedExp && data.kpis.expGainedThisMonth > 0 ? '~' : ''}{formatExp(data.kpis.expGainedThisMonth)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  {renderTrendIcon(computed.expChangePercent > 0 ? 'up' : computed.expChangePercent < 0 ? 'down' : 'neutral', 14)}
                  <span className={computed.expChangePercent > 0 ? 'text-emerald-400' : computed.expChangePercent < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                    {computed.expChangePercent > 0 ? '+' : ''}{computed.expChangePercent.toFixed(1)}{t('kpis.vsLastMonth')}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Star size={16} className="text-primary" />
                  {t('kpis.bestDayExp')}
                  {data.estimatedExp && data.kpis.bestDayEver.expGained > 0 && (
                    <span className="ml-auto text-[10px] font-normal text-amber-400/70">~est.</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.kpis.bestDayEver.expGained > 0
                    ? `${data.estimatedExp ? '~' : ''}${formatExp(data.kpis.bestDayEver.expGained)}`
                    : '—'}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.kpis.bestDayEver.date
                    ? format(new Date(data.kpis.bestDayEver.date), 'MMM d, yyyy')
                    : t('kpis.noDataYet')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar size={16} className="text-primary" />
                  {t('kpis.bestWeekExp')}
                  {data.estimatedExp && data.kpis.bestWeekEver.expGained > 0 && (
                    <span className="ml-auto text-[10px] font-normal text-amber-400/70">~est.</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.kpis.bestWeekEver.expGained > 0
                    ? `${data.estimatedExp ? '~' : ''}${formatExp(data.kpis.bestWeekEver.expGained)}`
                    : '—'}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.kpis.bestWeekEver.startDate
                    ? `${format(new Date(data.kpis.bestWeekEver.startDate), 'MMM d')} – ${format(new Date(data.kpis.bestWeekEver.endDate!), 'MMM d, yyyy')}`
                    : t('kpis.noDataYet')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Character Valuation (Premium) */}
          <ValuationCard characterName={data.character.name} />

          {/* Compare View (if comparing) */}
          {compareData && (
            <CompareView
              primary={{ character: data.character, snapshots: data.snapshots, kpis: data.kpis }}
              compare={{ character: compareData.character, snapshots: compareData.snapshots, kpis: compareData.kpis }}
            />
          )}

          {/* EXP Chart + Pace Calculator */}
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <ExpChart
              snapshots={data.snapshots}
              compareSnapshots={compareData?.snapshots}
              compareName={compareData?.character.name}
            />
            <SessionCalculator
              currentLevel={data.kpis.currentLevel}
              currentExp={data.snapshots.length > 0 ? data.snapshots[data.snapshots.length - 1].experience : null}
              avgDailyExp={computed.avgDailyExp}
              avgWeeklyExp={computed.avgWeeklyExp}
            />
          </div>

          {/* Skill Progression Chart */}
          <SkillChart
            snapshots={data.snapshots}
            vocation={data.character.vocation || 'None'}
          />

          {/* EXP Heatmap */}
          <TrainingHeatmap snapshots={data.snapshots} />

          {/* Skills Overview: Grid + Vocation Comparison */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SkillGrid
              vocation={data.character.vocation || 'None'}
              currentSkills={latestSkills}
              previousSkills={earliestSkills}
            />
            <VocationComparison
              characterName={data.character.name}
              vocation={data.character.vocation || 'None'}
              currentStats={latestSkills ? {
                level: data.snapshots[data.snapshots.length - 1]?.level ?? null,
                ...latestSkills,
              } : null}
              vocationAverages={data.vocationAverages}
            />
          </div>

          {/* Server Rankings + Milestones */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy size={20} className="text-amber-400" />
                  {t('rankings.heading')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const RANK_SKILLS: { key: string; label: string; color: string }[] = [
                    { key: 'experience', label: 'EXP', color: 'text-violet-400' },
                    { key: 'magicLevel', label: 'Magic Level', color: 'text-purple-400' },
                    { key: 'fist', label: 'Fist', color: 'text-orange-400' },
                    { key: 'club', label: 'Club', color: 'text-orange-400' },
                    { key: 'sword', label: 'Sword', color: 'text-red-400' },
                    { key: 'axe', label: 'Axe', color: 'text-red-400' },
                    { key: 'distance', label: 'Distance', color: 'text-amber-400' },
                    { key: 'shielding', label: 'Shielding', color: 'text-blue-400' },
                    { key: 'fishing', label: 'Fishing', color: 'text-cyan-400' },
                    { key: 'charmPoints', label: 'Charm Points', color: 'text-pink-400' },
                    { key: 'bountyPoints', label: 'Bounty Points', color: 'text-lime-400' },
                  ];
                  const ranks = data.skillRanks;
                  const rankedSkills = ranks
                    ? RANK_SKILLS.filter((s) => ranks[s.key as keyof typeof ranks] != null)
                    : [];

                  if (rankedSkills.length === 0) {
                    return <p className="text-sm text-muted-foreground">{t('rankings.noRankingData')}</p>;
                  }

                  // Show EXP rank prominently if available, then others as compact rows
                  const expRank = rankedSkills.find((s) => s.key === 'experience');
                  const otherRanks = rankedSkills.filter((s) => s.key !== 'experience');

                  return (
                    <>
                      {expRank && ranks && (
                        <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                          <div>
                            <div className="text-sm text-muted-foreground">{t('rankings.expRank')}</div>
                            <div className="text-2xl font-bold">#{ranks[expRank.key as keyof typeof ranks]}</div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {t('rankings.amongPlayers', { vocation: data.character.vocation || 'all' })}
                          </Badge>
                        </div>
                      )}
                      {otherRanks.length > 0 && ranks && (
                        <div className="space-y-1.5">
                          {otherRanks.map((s) => (
                            <div key={s.key} className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2">
                              <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>
                              <Badge variant="outline" className="text-xs font-bold">
                                #{ranks[s.key as keyof typeof ranks]}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
                {data.kpis.skillChangesThisMonth.length > 0 && (
                  <div className="border-t border-border/30 pt-4">
                    <div className="text-sm font-medium mb-2">{t('rankings.skillsUpgraded')}</div>
                    <div className="flex flex-wrap gap-1">
                      {data.kpis.skillChangesThisMonth.map((s) => (
                        <Badge key={s.skill} variant="secondary" className="text-xs bg-accent/30 border-border/50">
                          {SKILL_LABELS[s.skill] || s.skill} +{s.change}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <MilestonesFeed
              milestones={data.milestones.map((m) => ({
                type: m.type,
                title: m.description,
                description: m.skill ? `${m.skill} reached ${m.value}` : `Milestone: ${m.value}`,
                date: m.date,
              }))}
            />
          </div>
        </>
      )}

      {/* Empty State — World Leaders */}
      {!loading && !data && (
        <WorldLeaders onSelectCharacter={selectCharacter} />
      )}
    </div>
  );
}
