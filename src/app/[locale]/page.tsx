export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { Zap, TrendingUp, Calculator, ArrowRight, Flame, Crown, Globe, Store, Ban, ArrowRightLeft, Swords, Lightbulb, Trophy } from 'lucide-react';
import { LogoIcon } from '@/components/brand/Logo';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

interface TopGainer {
  character_name: string;
  world: string;
  vocation: string;
  current_level: number;
  exp_gained: bigint;
}

interface CategoryLeader {
  category: string;
  character_name: string;
  world: string;
  vocation: string;
  level: number;
  score: bigint;
}

interface PvpLeader {
  killer_name: string;
  kills: bigint;
}

const getHomeData = unstable_cache(async () => {
  const [liveAuctions, trackedCharacters, topGainersRaw, activeBans, totalTransfers, pvpKills, categoryLeadersRaw, pvpLeaderRaw] = await Promise.all([
    prisma.currentAuction.count({ where: { isActive: true } }),
    prisma.character.count(),
    prisma.$queryRaw<TopGainer[]>`
      WITH ordered AS (
        SELECT character_name, world, vocation, level, score, captured_date,
          LAG(score) OVER (PARTITION BY character_name, world ORDER BY captured_date) as prev_score,
          LAG(level) OVER (PARTITION BY character_name, world ORDER BY captured_date) as prev_level,
          ROW_NUMBER() OVER (PARTITION BY character_name, world ORDER BY captured_date) as rn
        FROM highscore_entries
        WHERE category = 'Experience Points'
          AND captured_date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      breakpoints AS (
        SELECT character_name, world, MAX(rn) as break_rn
        FROM ordered
        WHERE prev_score IS NOT NULL AND (
          score < prev_score * 0.7
          OR (prev_level >= 500 AND level - prev_level > 50)
        )
        GROUP BY character_name, world
      ),
      clean AS (
        SELECT o.character_name, o.world, o.vocation, o.level, o.score, o.captured_date,
          ROW_NUMBER() OVER (PARTITION BY o.character_name, o.world ORDER BY o.captured_date ASC) as rn_first,
          ROW_NUMBER() OVER (PARTITION BY o.character_name, o.world ORDER BY o.captured_date DESC) as rn_last
        FROM ordered o
        LEFT JOIN breakpoints b ON o.character_name = b.character_name AND o.world = b.world
        WHERE o.rn > COALESCE(b.break_rn, 0)
      ),
      gains AS (
        SELECT f.character_name, f.world, l.vocation,
          l.level as current_level,
          (l.score - f.score) as exp_gained
        FROM clean f
        JOIN clean l ON f.character_name = l.character_name AND f.world = l.world
        WHERE f.rn_first = 1 AND l.rn_last = 1 AND l.score > f.score
      )
      SELECT character_name, world, vocation, current_level, exp_gained
      FROM gains ORDER BY exp_gained DESC LIMIT 5
    `,
    prisma.ban.count({ where: { isActive: true } }),
    prisma.transfer.count(),
    prisma.pvpKill.count(),
    prisma.$queryRaw<CategoryLeader[]>`
      WITH latest AS (
        SELECT category, character_name, world, vocation, level, score,
          ROW_NUMBER() OVER (PARTITION BY category ORDER BY score DESC) as global_rank
        FROM highscore_entries
        WHERE captured_date = (SELECT MAX(captured_date) FROM highscore_entries)
          AND category IN ('Experience Points', 'Sword Fighting', 'Axe Fighting', 'Club Fighting', 'Magic Level', 'Distance Fighting', 'Fist Fighting', 'Charm Points', 'Bounty Points')
      )
      SELECT category, character_name, world, vocation, level, score
      FROM latest WHERE global_rank = 1
      ORDER BY category
    `,
    prisma.$queryRaw<PvpLeader[]>`
      SELECT killer_name, COUNT(*) as kills
      FROM pvp_kills
      GROUP BY killer_name
      ORDER BY kills DESC
      LIMIT 1
    `,
  ]);

  const topGainers = topGainersRaw.map(g => ({
    ...g,
    exp_gained: Number(g.exp_gained),
  }));

  const categoryLeaders = categoryLeadersRaw.map(l => ({
    ...l,
    score: Number(l.score),
  }));

  const pvpLeader = pvpLeaderRaw.length > 0
    ? { killer_name: pvpLeaderRaw[0].killer_name, kills: Number(pvpLeaderRaw[0].kills) }
    : null;

  return { liveAuctions, trackedCharacters, topGainers, activeBans, totalTransfers, pvpKills, categoryLeaders, pvpLeader };
}, ['home-data'], { revalidate: 300 }); // cache for 5 minutes

async function HomeContent() {
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const { liveAuctions, trackedCharacters, topGainers, activeBans, totalTransfers, pvpKills, categoryLeaders, pvpLeader } = await getHomeData();

  const features = [
    {
      href: '/current-auctions' as const,
      title: t('auctionMarketTitle'),
      icon: Zap,
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
      iconBg: 'bg-amber-500/15',
      color: 'text-amber-400',
      accentBorder: 'border-l-amber-500',
      description: t('auctionMarketDesc'),
      stat: liveAuctions,
      statLabel: t('auctionMarketStat'),
    },
    {
      href: '/progression' as const,
      title: t('progressionTitle'),
      icon: TrendingUp,
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      iconBg: 'bg-emerald-500/15',
      color: 'text-emerald-400',
      accentBorder: 'border-l-emerald-500',
      description: t('progressionDesc'),
      stat: trackedCharacters,
      statLabel: t('progressionStat'),
    },
    {
      href: '/calculator' as const,
      title: t('calculatorTitle'),
      icon: Calculator,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      iconBg: 'bg-sky-500/15',
      color: 'text-sky-400',
      accentBorder: 'border-l-sky-500',
      description: t('calculatorDesc'),
      stat: null as number | null,
      statLabel: null as string | null,
    },
    {
      href: '/item-market' as const,
      title: t('itemMarketTitle'),
      icon: Store,
      gradient: 'from-violet-500/20 via-violet-500/10 to-transparent',
      iconBg: 'bg-violet-500/15',
      color: 'text-violet-400',
      accentBorder: 'border-l-violet-500',
      description: t('itemMarketDesc'),
      stat: null as number | null,
      statLabel: null as string | null,
    },
    {
      href: '/bans' as const,
      title: t('bansTitle'),
      icon: Ban,
      gradient: 'from-red-500/20 via-red-500/10 to-transparent',
      iconBg: 'bg-red-500/15',
      color: 'text-red-400',
      accentBorder: 'border-l-red-500',
      description: t('bansDesc'),
      stat: activeBans,
      statLabel: t('bansStat'),
    },
    {
      href: '/transfers' as const,
      title: t('transfersTitle'),
      icon: ArrowRightLeft,
      gradient: 'from-cyan-500/20 via-cyan-500/10 to-transparent',
      iconBg: 'bg-cyan-500/15',
      color: 'text-cyan-400',
      accentBorder: 'border-l-cyan-500',
      description: t('transfersDesc'),
      stat: totalTransfers,
      statLabel: t('transfersStat'),
    },
    {
      href: '/pvp' as const,
      title: t('pvpTitle'),
      icon: Swords,
      gradient: 'from-rose-500/20 via-rose-500/10 to-transparent',
      iconBg: 'bg-rose-500/15',
      color: 'text-rose-400',
      accentBorder: 'border-l-rose-500',
      description: t('pvpDesc'),
      stat: pvpKills,
      statLabel: t('pvpStat'),
    },
    {
      href: '/premium' as const,
      title: t('premiumTitle'),
      icon: Crown,
      gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
      iconBg: 'bg-amber-500/15',
      color: 'text-amber-400',
      accentBorder: 'border-l-amber-500',
      description: t('premiumDesc'),
      stat: null as number | null,
      statLabel: null as string | null,
    },
    {
      href: '/feature-requests' as const,
      title: t('featureRequestsTitle'),
      icon: Lightbulb,
      gradient: 'from-yellow-500/20 via-yellow-500/10 to-transparent',
      iconBg: 'bg-yellow-500/15',
      color: 'text-yellow-400',
      accentBorder: 'border-l-yellow-500',
      description: t('featureRequestsDesc'),
      stat: null as number | null,
      statLabel: null as string | null,
    },
  ];

  const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    'Experience Points': { label: t('catExp'), color: 'text-emerald-400', icon: 'exp' },
    'Sword Fighting': { label: t('catSword'), color: 'text-red-400', icon: 'sword' },
    'Axe Fighting': { label: t('catAxe'), color: 'text-orange-400', icon: 'axe' },
    'Club Fighting': { label: t('catClub'), color: 'text-amber-400', icon: 'club' },
    'Magic Level': { label: t('catMagic'), color: 'text-purple-400', icon: 'magic' },
    'Distance Fighting': { label: t('catDistance'), color: 'text-yellow-400', icon: 'distance' },
    'Fist Fighting': { label: t('catFist'), color: 'text-orange-300', icon: 'fist' },
    'Charm Points': { label: t('catCharms'), color: 'text-pink-400', icon: 'charms' },
    'Bounty Points': { label: t('catBounty'), color: 'text-lime-400', icon: 'bounty' },
  };

  return (
    <>
      {/* Top EXP Gainers — mini leaderboard */}
      {topGainers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold">{t('topGainersHeading')}</h2>
              <span className="text-xs text-muted-foreground">{t('topGainersPeriod')}</span>
            </div>
            <Link href="/progression" className="flex items-center gap-1 text-xs text-primary hover:underline">
              {t('fullLeaderboard')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {topGainers.map((gainer, i) => (
              <Link
                key={gainer.character_name}
                href={`/progression?character=${encodeURIComponent(gainer.character_name)}`}
                className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/50 p-3 transition-colors hover:bg-card hover:border-border/60"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  i === 0 ? 'bg-amber-400/15 text-amber-400' :
                  i === 1 ? 'bg-slate-300/15 text-slate-300' :
                  i === 2 ? 'bg-amber-700/15 text-amber-600' :
                  'bg-secondary/50 text-muted-foreground'
                }`}>
                  {i === 0 ? <Crown className="h-4 w-4" /> : `#${i + 1}`}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {gainer.character_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Globe className="h-2.5 w-2.5" />
                    <span>{gainer.world}</span>
                    <span className="text-foreground/30">·</span>
                    <span>{tc('levelAbbr')} {gainer.current_level}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-emerald-400">
                    {formatNumber(gainer.exp_gained)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{tc('expSuffix')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top #1 Players per Category */}
      {categoryLeaders.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold">{t('topPlayersHeading')}</h2>
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {pvpLeader && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/50 p-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
                  <Swords className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-rose-400">{t('catPvp')}</p>
                  <p className="text-xs font-semibold truncate">{pvpLeader.killer_name}</p>
                  <p className="text-[10px] text-muted-foreground">{pvpLeader.kills} kills</p>
                </div>
              </div>
            )}
            {categoryLeaders.map((leader) => {
              const cfg = CATEGORY_CONFIG[leader.category];
              if (!cfg) return null;
              return (
                <Link
                  key={leader.category}
                  href={`/progression?character=${encodeURIComponent(leader.character_name)}`}
                  className="group flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/50 p-2.5 transition-colors hover:bg-card hover:border-border/60"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary/50">
                    <Crown className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{leader.character_name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{leader.world}</span>
                      <span className="text-foreground/30">·</span>
                      <span className="font-medium">{leader.category === 'Experience Points' || leader.category === 'Charm Points' || leader.category === 'Bounty Points' ? formatNumber(leader.score) : leader.score}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Feature Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ href, title, icon: Icon, gradient, iconBg, color, accentBorder, description, stat, statLabel }) => (
          <Link key={href} href={href} className="group">
            <div className={`relative h-full overflow-hidden rounded-xl border border-border/50 border-l-4 ${accentBorder} bg-card transition-all duration-200 group-hover:border-border group-hover:shadow-lg group-hover:shadow-black/20`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-80 transition-opacity`} />

              <div className="relative flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:translate-x-1 group-hover:text-foreground" />
                </div>

                <div>
                  <h2 className="text-lg font-bold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>

                {stat !== null && (
                  <div className="mt-auto flex items-baseline gap-1.5 pt-3 border-t border-border/30">
                    <span className={`text-xl font-bold ${color}`}>
                      {formatNumber(stat)}
                    </span>
                    <span className="text-xs text-muted-foreground">{statLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </section>

    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <section>
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 border-l-4 border-l-border bg-card p-5">
            <Skeleton className="h-10 w-10 rounded-lg mb-3" />
            <Skeleton className="h-5 w-28 mb-2" />
            <Skeleton className="h-10 w-full mb-3" />
            <div className="pt-3 border-t border-border/30">
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Hero — logo with ambient glow */}
      <section className="flex flex-col items-center space-y-3 text-center">
        <div
          className="relative"
          style={{
            filter: 'drop-shadow(0 0 24px rgba(245,158,11,0.3)) drop-shadow(0 0 48px rgba(245,158,11,0.15))',
          }}
        >
          <LogoIcon size={56} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-foreground">RubinOT</span>{' '}
          <span className="text-amber-400">Stats</span>
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          {t('tagline')}
        </p>
        <p className="text-xs text-muted-foreground/60 italic">
          {t('subTagline')}
        </p>
      </section>

      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}
