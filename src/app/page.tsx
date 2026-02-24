export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import Image from 'next/image';
import { Zap, TrendingUp, Calculator, ArrowRight, Flame, Crown, Globe } from 'lucide-react';
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

const getHomeData = unstable_cache(async () => {
  const [liveAuctions, trackedCharacters, topGainersRaw] = await Promise.all([
    prisma.currentAuction.count({ where: { isActive: true } }),
    prisma.character.count(),
    prisma.$queryRaw<TopGainer[]>`
      WITH date_range AS (
        SELECT character_name, world, vocation, level, score, captured_date,
          ROW_NUMBER() OVER (PARTITION BY character_name, world ORDER BY captured_date ASC) as rn_first,
          ROW_NUMBER() OVER (PARTITION BY character_name, world ORDER BY captured_date DESC) as rn_last
        FROM highscore_entries
        WHERE category = 'Experience Points'
          AND captured_date >= CURRENT_DATE - INTERVAL '30 days'
      ),
      gains AS (
        SELECT f.character_name, f.world, f.vocation,
          l.level as current_level,
          (l.score - f.score) as exp_gained
        FROM date_range f
        JOIN date_range l ON f.character_name = l.character_name AND f.world = l.world
        WHERE f.rn_first = 1 AND l.rn_last = 1 AND l.score > f.score
      )
      SELECT character_name, world, vocation, current_level, exp_gained
      FROM gains ORDER BY exp_gained DESC LIMIT 5
    `,
  ]);

  const topGainers = topGainersRaw.map(g => ({
    ...g,
    exp_gained: Number(g.exp_gained),
  }));

  return { liveAuctions, trackedCharacters, topGainers };
}, ['home-data'], { revalidate: 300 }); // cache for 5 minutes

const features = [
  {
    href: '/current-auctions',
    title: 'Auction Market',
    icon: Zap,
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    iconBg: 'bg-amber-500/15',
    color: 'text-amber-400',
    accentBorder: 'border-l-amber-500',
    description: 'Browse live character auctions, track bids, and find the best deals.',
    statKey: 'liveAuctions' as const,
    statLabel: 'live auctions',
  },
  {
    href: '/progression',
    title: 'Progression',
    icon: TrendingUp,
    gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
    iconBg: 'bg-emerald-500/15',
    color: 'text-emerald-400',
    accentBorder: 'border-l-emerald-500',
    description: 'Track EXP, skills, and milestones. Compare players across worlds.',
    statKey: 'trackedCharacters' as const,
    statLabel: 'characters tracked',
  },
  {
    href: '/calculator',
    title: 'Skill Calculator',
    icon: Calculator,
    gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
    iconBg: 'bg-sky-500/15',
    color: 'text-sky-400',
    accentBorder: 'border-l-sky-500',
    description: 'Plan training sessions, estimate costs, and optimize advancement.',
    statKey: null,
    statLabel: null,
  },
];

async function HomeContent() {
  const { liveAuctions, trackedCharacters, topGainers } = await getHomeData();
  const stats = { liveAuctions, trackedCharacters };

  return (
    <>
      {/* Feature Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ href, title, icon: Icon, gradient, iconBg, color, accentBorder, description, statKey, statLabel }) => (
          <Link key={href} href={href} className="group">
            <div className={`relative h-full overflow-hidden rounded-xl border border-border/50 border-l-4 ${accentBorder} bg-card transition-all duration-200 group-hover:border-border group-hover:shadow-lg group-hover:shadow-black/20`}>
              {/* Gradient glow */}
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

                {statKey && (
                  <div className="mt-auto flex items-baseline gap-1.5 pt-3 border-t border-border/30">
                    <span className={`text-xl font-bold ${color}`}>
                      {formatNumber(stats[statKey])}
                    </span>
                    <span className="text-xs text-muted-foreground">{statLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Top EXP Gainers — mini leaderboard */}
      {topGainers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold">Top EXP Gainers</h2>
              <span className="text-xs text-muted-foreground">Last 30 days</span>
            </div>
            <Link href="/progression" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Full leaderboard <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {topGainers.map((gainer, i) => (
              <Link
                key={gainer.character_name}
                href={`/progression?character=${encodeURIComponent(gainer.character_name)}`}
                className="group flex items-center gap-3 rounded-xl border border-border/30 bg-card/50 p-3 transition-colors hover:bg-card hover:border-border/60"
              >
                {/* Rank */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  i === 0 ? 'bg-amber-400/15 text-amber-400' :
                  i === 1 ? 'bg-slate-300/15 text-slate-300' :
                  i === 2 ? 'bg-amber-700/15 text-amber-600' :
                  'bg-secondary/50 text-muted-foreground'
                }`}>
                  {i === 0 ? <Crown className="h-4 w-4" /> : `#${i + 1}`}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {gainer.character_name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Globe className="h-2.5 w-2.5" />
                    <span>{gainer.world}</span>
                    <span className="text-foreground/30">·</span>
                    <span>Lvl {gainer.current_level}</span>
                  </div>
                </div>

                {/* EXP */}
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-emerald-400">
                    {formatNumber(gainer.exp_gained)}
                  </p>
                  <p className="text-[9px] text-muted-foreground">exp</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Premium promo card */}
      <section className="mx-auto max-w-sm">
        <Link href="/premium" className="group block">
          <div className="relative overflow-hidden rounded-xl border border-amber-400/20 bg-card transition-all duration-200 group-hover:border-amber-400/40 group-hover:shadow-lg group-hover:shadow-amber-400/10">
            <Image
              src="/premium-features.jpg"
              alt="Premium Status — Key Market Insights, Highlight Auctions, and more"
              width={600}
              height={600}
              className="w-full h-auto"
            />
          </div>
        </Link>
      </section>
    </>
  );
}

function HomeSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
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
      <section>
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Hero — compact */}
      <section className="flex flex-col items-center space-y-3 text-center">
        <LogoIcon size={56} className="text-white" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-foreground">RubinOT</span>{' '}
          <span className="text-primary">Stats</span>
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Character Progression Tracker &amp; Auction Intelligence
        </p>
        <p className="text-xs text-muted-foreground/60 italic">
          travecos welcomed
        </p>
      </section>

      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}
