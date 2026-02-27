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
import TrainingHeatmap from './components/TrainingHeatmap';
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
      expRank: number | null;
      mlRank: number | null;
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
    milestones: Array<{
      type: 'level' | 'skill' | 'rank';
      description: string;
      date: string;
      value: number;
      skill?: string;
      category?: string;
    }>;
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

  const renderTrendIcon = (direction: 'up' | 'down' | 'neutral', size = 16) => {
    if (direction === 'up') return <TrendingUp size={size} className="text-emerald-400" />;
    if (direction === 'down') return <TrendingDown size={size} className="text-red-400" />;
    return <Minus size={size} className="text-muted-foreground" />;
  };

  return (
    <div className="space-y-8">
      {/* Search Bar — centered when no character loaded, compact when loaded */}
      <div className={`flex flex-col items-center ${data ? 'items-start' : ''}`}>
        {!data && !loading && (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              {t('searchDescription')}
            </p>
            <p className="text-xs text-muted-foreground/60 mb-3">
              {t('dataUpdatedNote')}
            </p>
          </>
        )}
        <div className={`relative w-full ${data ? 'max-w-md' : 'max-w-lg'}`} ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 bg-card/50 border-border/50 backdrop-blur ${!data ? 'h-12 text-base' : ''}`}
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
          <div className={`mt-3 w-full ${data ? 'max-w-md' : 'max-w-lg'}`}>
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
        {!data && !loading && savedCharacters.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground/50">{t('saved.empty')}</p>
        )}
      </div>

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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatExp(data.kpis.expGainedThisMonth)}</div>
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.kpis.bestDayEver.expGained > 0 ? formatExp(data.kpis.bestDayEver.expGained) : '—'}
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.kpis.bestWeekEver.expGained > 0 ? formatExp(data.kpis.bestWeekEver.expGained) : '—'}
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

          {/* EXP Heatmap */}
          <TrainingHeatmap snapshots={data.snapshots} />

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
                {data.kpis.currentExpRank ? (
                  <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('rankings.expRank')}</div>
                      <div className="text-2xl font-bold">#{data.kpis.currentExpRank}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t('rankings.amongPlayers', { vocation: data.character.vocation || 'all' })}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('rankings.noRankingData')}</p>
                )}
                {data.kpis.currentMlRank && (
                  <div className="flex items-center justify-between bg-background/50 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-muted-foreground">{t('rankings.magicLevelRank')}</div>
                      <div className="text-2xl font-bold">#{data.kpis.currentMlRank}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {t('rankings.amongPlayers', { vocation: data.character.vocation || 'all' })}
                    </Badge>
                  </div>
                )}
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
