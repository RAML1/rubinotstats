'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown, Minus, Search, Trophy, Zap, Swords, Medal } from 'lucide-react';
import { formatNumber, formatExp } from '@/lib/utils/formatters';
import { trackSearch } from '@/components/analytics/AnalyticsTracker';
import ExpChart from './components/ExpChart';
import SkillGrid from './components/SkillGrid';
import TrainingHeatmap from './components/TrainingHeatmap';
import BestRecords from './components/BestRecords';
import MilestonesFeed from './components/MilestonesFeed';
import { SessionCalculator } from './components/SessionCalculator';
import { VocationComparison } from './components/VocationComparison';
import SkillDistribution from './components/SkillDistribution';

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

export default function ProgressionClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [data, setData] = useState<APIResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
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
  }, [searchQuery]);

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

  // Derive computed values from API data
  const computed = useMemo(() => {
    if (!data) return null;

    const { kpis, snapshots } = data;
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

    // EXP change percent
    const expChangePercent = kpis.expGainedLastMonth > 0
      ? ((kpis.expGainedThisMonth - kpis.expGainedLastMonth) / kpis.expGainedLastMonth) * 100
      : 0;

    // Level change direction
    const levelsDir = kpis.levelsGainedThisMonth > kpis.levelsGainedLastMonth ? 'up' as const
      : kpis.levelsGainedThisMonth < kpis.levelsGainedLastMonth ? 'down' as const
      : 'neutral' as const;

    // Avg daily/weekly exp
    const totalExp = snapshots.reduce((sum, s) => sum + (s.expGained || 0), 0);
    const avgDailyExp = snapshots.length > 0 ? totalExp / snapshots.length : 0;
    const avgWeeklyExp = avgDailyExp * 7;

    // Best day with levels
    const bestDaySnapshot = snapshots.reduce((best, s) =>
      (s.expGained || 0) > (best?.expGained || 0) ? s : best, snapshots[0]);

    return {
      expChangePercent,
      levelsDir,
      avgDailyExp,
      avgWeeklyExp,
      currentSkills: latestSnapshot ? {
        magicLevel: latestSnapshot.magicLevel,
        fist: latestSnapshot.fist,
        club: latestSnapshot.club,
        sword: latestSnapshot.sword,
        axe: latestSnapshot.axe,
        distance: latestSnapshot.distance,
        shielding: latestSnapshot.shielding,
        fishing: latestSnapshot.fishing,
      } : null,
      previousSkills: previousSnapshot ? {
        magicLevel: previousSnapshot.magicLevel,
        fist: previousSnapshot.fist,
        club: previousSnapshot.club,
        sword: previousSnapshot.sword,
        axe: previousSnapshot.axe,
        distance: previousSnapshot.distance,
        shielding: previousSnapshot.shielding,
        fishing: previousSnapshot.fishing,
      } : null,
      currentStats: latestSnapshot ? {
        level: latestSnapshot.level,
        magicLevel: latestSnapshot.magicLevel,
        fist: latestSnapshot.fist,
        club: latestSnapshot.club,
        sword: latestSnapshot.sword,
        axe: latestSnapshot.axe,
        distance: latestSnapshot.distance,
        shielding: latestSnapshot.shielding,
        fishing: latestSnapshot.fishing,
      } : null,
      bestDayLevels: bestDaySnapshot?.levelsGained || 0,
      bestWeekLevels: 0, // Approximation
    };
  }, [data]);

  const renderTrendIcon = (direction: 'up' | 'down' | 'neutral', size = 16) => {
    if (direction === 'up') return <TrendingUp size={size} className="text-emerald-400" />;
    if (direction === 'down') return <TrendingDown size={size} className="text-red-400" />;
    return <Minus size={size} className="text-muted-foreground" />;
  };

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-md" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            type="text"
            placeholder="Search character name..."
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

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Main Content */}
      {!loading && data && computed && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Trophy size={16} className="text-primary" />
                  Current Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.kpis.currentLevel}</div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  {renderTrendIcon(computed.levelsDir, 14)}
                  <span className={computed.levelsDir === 'up' ? 'text-emerald-400' : computed.levelsDir === 'down' ? 'text-red-400' : 'text-muted-foreground'}>
                    {data.kpis.levelsGainedThisMonth > 0 ? '+' : ''}{data.kpis.levelsGainedThisMonth} this month
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Zap size={16} className="text-primary" />
                  EXP This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatExp(data.kpis.expGainedThisMonth)}</div>
                <div className="mt-1 flex items-center gap-1 text-sm">
                  {renderTrendIcon(computed.expChangePercent > 0 ? 'up' : computed.expChangePercent < 0 ? 'down' : 'neutral', 14)}
                  <span className={computed.expChangePercent > 0 ? 'text-emerald-400' : computed.expChangePercent < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                    {computed.expChangePercent > 0 ? '+' : ''}{computed.expChangePercent.toFixed(1)}% vs last month
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Swords size={16} className="text-primary" />
                  Skills Upgraded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.kpis.skillChangesThisMonth.length}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.kpis.skillChangesThisMonth.slice(0, 3).map((s) => (
                    <Badge key={s.skill} variant="secondary" className="text-xs bg-accent/30 border-border/50">
                      {s.skill} +{s.change}
                    </Badge>
                  ))}
                  {data.kpis.skillChangesThisMonth.length > 3 && (
                    <Badge variant="secondary" className="text-xs bg-accent/30 border-border/50">
                      +{data.kpis.skillChangesThisMonth.length - 3} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Medal size={16} className="text-primary" />
                  Server Rank
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {data.kpis.currentExpRank ? `#${data.kpis.currentExpRank}` : '—'}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.kpis.currentMlRank ? `ML Rank: #${data.kpis.currentMlRank}` : 'Experience ranking'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* EXP Chart */}
          <ExpChart snapshots={data.snapshots} />

          {/* Skill Grid + Skill Distribution */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SkillGrid
                currentSkills={computed.currentSkills}
                previousSkills={computed.previousSkills}
              />
            </div>
            <div>
              <SkillDistribution snapshots={data.snapshots} />
            </div>
          </div>

          {/* Training Heatmap */}
          <TrainingHeatmap snapshots={data.snapshots} />

          {/* Best Records + Session Calculator */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BestRecords
              bestDay={data.kpis.bestDayEver.date ? {
                date: data.kpis.bestDayEver.date,
                expGained: data.kpis.bestDayEver.expGained,
                levelsGained: computed.bestDayLevels,
              } : null}
              bestWeek={data.kpis.bestWeekEver.startDate ? {
                startDate: data.kpis.bestWeekEver.startDate,
                endDate: data.kpis.bestWeekEver.endDate!,
                expGained: data.kpis.bestWeekEver.expGained,
                levelsGained: computed.bestWeekLevels,
              } : null}
            />
            <SessionCalculator
              currentLevel={data.kpis.currentLevel}
              currentExp={data.snapshots.length > 0 ? data.snapshots[data.snapshots.length - 1].experience : null}
              avgDailyExp={computed.avgDailyExp}
              avgWeeklyExp={computed.avgWeeklyExp}
            />
          </div>

          {/* Milestones Feed + Vocation Comparison */}
          <div className="grid gap-4 lg:grid-cols-2">
            <MilestonesFeed
              milestones={data.milestones.map((m, i) => ({
                type: m.type,
                title: m.description,
                description: m.skill ? `${m.skill} reached ${m.value}` : `Milestone: ${m.value}`,
                date: m.date,
              }))}
            />
            <VocationComparison
              characterName={data.character.name}
              vocation={data.character.vocation || 'None'}
              currentStats={computed.currentStats}
              vocationAverages={data.vocationAverages}
            />
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !data && (
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={48} className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No character selected</h3>
            <p className="text-muted-foreground">
              Search for a character above to view their progression statistics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
