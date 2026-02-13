export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { Gavel, TrendingUp, Users, Globe, ArrowRight, Swords, Shield, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

async function getStats() {
  const [totalAuctions, totalHighscores, totalWorlds, avgPrice, recentAuctions, topPlayers] =
    await Promise.all([
      prisma.auction.count(),
      prisma.highscoreEntry.count(),
      prisma.world.count(),
      prisma.auction.aggregate({ _avg: { soldPrice: true } }),
      prisma.auction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.highscoreEntry.findMany({
        where: { category: 'Experience Points' },
        orderBy: { score: 'desc' },
        take: 5,
        distinct: ['characterName'],
      }),
    ]);

  return { totalAuctions, totalHighscores, totalWorlds, avgPrice: avgPrice._avg.soldPrice, recentAuctions, topPlayers };
}

function StatCard({ title, value, icon: Icon, description }: { title: string; value: string; icon: React.ElementType; description: string }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function getVocationIcon(vocation: string) {
  if (vocation.includes('Knight')) return Swords;
  if (vocation.includes('Paladin')) return TrendingUp;
  if (vocation.includes('Druid')) return Shield;
  if (vocation.includes('Sorcerer')) return Sparkles;
  return Users;
}

async function DashboardContent() {
  const { totalAuctions, totalHighscores, totalWorlds, avgPrice, recentAuctions, topPlayers } = await getStats();

  return (
    <>
      {/* Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Auctions"
          value={formatNumber(totalAuctions)}
          icon={Gavel}
          description="Sold character auctions tracked"
        />
        <StatCard
          title="Avg. Sold Price"
          value={`${formatNumber(Math.round(avgPrice || 0))} TC`}
          icon={TrendingUp}
          description="Average auction sale price"
        />
        <StatCard
          title="Highscore Entries"
          value={formatNumber(totalHighscores)}
          icon={Users}
          description="Leaderboard entries tracked"
        />
        <StatCard
          title="Active Worlds"
          value={String(totalWorlds)}
          icon={Globe}
          description="RubinOT game worlds"
        />
      </section>

      {/* Two-column: Recent Auctions + Top Players */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Recent Auctions */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Auctions</h2>
            <Link href="/auctions" className="flex items-center gap-1 text-sm text-primary hover:underline">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recentAuctions.map((auction) => (
              <Card key={auction.id} className="border-border/50 bg-card/50 backdrop-blur transition-colors hover:bg-card/80">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold"
                        style={{ backgroundColor: getVocationColor(auction.vocation || '') }}
                      >
                        {(auction.characterName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold leading-tight">{auction.characterName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                            style={{ borderColor: getVocationColor(auction.vocation || ''), color: getVocationColor(auction.vocation || '') }}
                          >
                            {auction.vocation}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Level</span>
                      <p className="font-semibold">{auction.level}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ML</span>
                      <p className="font-semibold">{auction.magicLevel || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">World</span>
                      <p className="font-semibold">{auction.world}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    <span className="text-xs text-muted-foreground">Sold Price</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatNumber(auction.soldPrice || 0)} TC
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Top Players */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Top Players</h2>
            <p className="text-sm text-muted-foreground">By Experience Points</p>
          </div>
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardContent className="p-0">
              {topPlayers.map((player, i) => (
                <div
                  key={`${player.characterName}-${player.world}`}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== topPlayers.length - 1 ? 'border-b border-border/50' : ''}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {player.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{player.characterName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{player.world}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: getVocationColor(player.vocation), color: getVocationColor(player.vocation) }}
                      >
                        {player.vocation}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">Lvl {player.level}</p>
                    <p className="text-xs text-muted-foreground">{formatNumber(Number(player.score))} exp</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /><Skeleton className="mt-1 h-3 w-32" /></CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="mb-4 h-7 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border/50 bg-card/50">
                <CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="mb-4 h-7 w-32" />
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      {/* Hero Section */}
      <section className="flex flex-col items-center space-y-4 text-center">
        <h1 className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          RubinOT Stats
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Character Progression Tracker & Auction Intelligence
        </p>
      </section>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
