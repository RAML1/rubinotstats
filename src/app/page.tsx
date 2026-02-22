export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { Zap, TrendingUp, Calculator, ArrowRight, Megaphone, Heart } from 'lucide-react';
import { LogoIcon } from '@/components/brand/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { formatNumber } from '@/lib/utils/formatters';

async function getQuickStats() {
  const [liveAuctions, trackedCharacters] = await Promise.all([
    prisma.currentAuction.count({ where: { isActive: true } }),
    prisma.character.count(),
  ]);
  return { liveAuctions, trackedCharacters };
}

const features = [
  {
    href: '/current-auctions',
    title: 'Auction Market',
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'hover:border-amber-400/50',
    description: 'Browse live character auctions, track bidding activity, and find deals on the RubinOT market.',
    statKey: 'liveAuctions' as const,
    statLabel: 'Live Auctions',
  },
  {
    href: '/progression',
    title: 'Progression',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'hover:border-emerald-400/50',
    description: 'Track character EXP, skills, and milestones over time. Compare players and view world leaderboards.',
    statKey: 'trackedCharacters' as const,
    statLabel: 'Characters Tracked',
  },
  {
    href: '/calculator',
    title: 'Skill Calculator',
    icon: Calculator,
    color: 'text-sky-400',
    bgColor: 'bg-sky-400/10',
    borderColor: 'hover:border-sky-400/50',
    description: 'Plan your training sessions, estimate costs, and optimize your skill advancement strategy.',
    statKey: null,
    statLabel: null,
  },
];

async function FeatureShowcase() {
  const stats = await getQuickStats();

  return (
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ href, title, icon: Icon, color, bgColor, borderColor, description, statKey, statLabel }) => (
        <Link key={href} href={href} className="group">
          <Card className={`h-full border-border/50 bg-card/50 backdrop-blur transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-lg ${borderColor}`}>
            <CardContent className="flex flex-col gap-4 p-6">
              {/* Icon */}
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgColor}`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>

              {/* Title + Arrow */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{title}</h2>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

              {/* Quick Stat */}
              {statKey && (
                <div className="mt-auto pt-4 border-t border-border/50">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${color}`}>
                      {formatNumber(stats[statKey])}
                    </span>
                    <span className="text-xs text-muted-foreground">{statLabel}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </section>
  );
}

function FeatureShowcaseSkeleton() {
  return (
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col gap-4 p-6">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-full" />
            <div className="pt-4 border-t border-border/50">
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Ad Banner */}
      <section className="rounded-xl border border-dashed border-border/50 bg-muted/20 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Advertise here — reach the RubinOT community
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Contact us for ad placement</p>
      </section>

      {/* Hero Section */}
      <section className="flex flex-col items-center space-y-4 text-center relative">
        {/* Tip Message — top right */}
        <div className="hidden sm:flex items-center gap-1.5 absolute top-0 right-0 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1.5">
          <Heart className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-xs text-amber-300">
            Show love by sending Rubinicoins to <strong>Super Bonk Lee</strong>
          </span>
        </div>

        <LogoIcon size={72} className="text-white" />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-foreground">RubinOT</span>{' '}
          <span className="text-primary">Stats</span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Character Progression Tracker &amp; Auction Intelligence
        </p>
      </section>

      {/* Feature Showcase */}
      <Suspense fallback={<FeatureShowcaseSkeleton />}>
        <FeatureShowcase />
      </Suspense>
    </div>
  );
}
