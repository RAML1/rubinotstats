export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { formatNumber, getVocationColor } from '@/lib/utils/formatters';

async function getMarketData() {
  const [vocationStats, priceRanges, recentHighPrice, recentLowPrice, totalAuctions] = await Promise.all([
    prisma.auction.groupBy({
      by: ['vocation'],
      _count: { id: true },
      _avg: { soldPrice: true, coinsPerLevel: true },
      _min: { soldPrice: true },
      _max: { soldPrice: true },
      where: { vocation: { not: null }, soldPrice: { not: null } },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.auction.groupBy({
      by: ['vocation'],
      _avg: { soldPrice: true },
      where: { vocation: { not: null }, soldPrice: { not: null } },
      orderBy: { _avg: { soldPrice: 'desc' } },
    }),
    prisma.auction.findFirst({
      orderBy: { soldPrice: 'desc' },
      where: { soldPrice: { not: null } },
      select: { characterName: true, soldPrice: true, level: true, vocation: true, world: true },
    }),
    prisma.auction.findFirst({
      orderBy: { soldPrice: 'asc' },
      where: { soldPrice: { not: null, gt: 0 } },
      select: { characterName: true, soldPrice: true, level: true, vocation: true, world: true },
    }),
    prisma.auction.count(),
  ]);

  return { vocationStats, priceRanges, recentHighPrice, recentLowPrice, totalAuctions };
}

async function MarketContent() {
  const { vocationStats, recentHighPrice, recentLowPrice, totalAuctions } = await getMarketData();

  const totalSold = vocationStats.reduce((acc, v) => acc + v._count.id, 0);
  const overallAvg = vocationStats.reduce((acc, v) => acc + (v._avg.soldPrice || 0) * v._count.id, 0) / (totalSold || 1);

  return (
    <>
      {/* Overview Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sold</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalAuctions)}</div>
            <p className="text-xs text-muted-foreground">Characters sold on auction</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Price</CardTitle>
            <Minus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(Math.round(overallAvg))} TC</div>
            <p className="text-xs text-muted-foreground">Across all vocations</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Highest Sale</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {formatNumber(recentHighPrice?.soldPrice || 0)} TC
            </div>
            <p className="text-xs text-muted-foreground">
              {recentHighPrice?.characterName} — Lvl {recentHighPrice?.level} {recentHighPrice?.vocation}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lowest Sale</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {formatNumber(recentLowPrice?.soldPrice || 0)} TC
            </div>
            <p className="text-xs text-muted-foreground">
              {recentLowPrice?.characterName} — Lvl {recentLowPrice?.level} {recentLowPrice?.vocation}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Vocation Breakdown */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Price by Vocation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vocationStats.map((stat) => {
            const vocColor = getVocationColor(stat.vocation || '');
            const percentage = totalSold > 0 ? ((stat._count.id / totalSold) * 100).toFixed(1) : '0';
            return (
              <Card key={stat.vocation} className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: vocColor }}
                      />
                      <p className="font-semibold">{stat.vocation}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{stat._count.id} sold ({percentage}%)</span>
                  </div>

                  {/* Price Bar Visual */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Avg: {formatNumber(Math.round(stat._avg.soldPrice || 0))} TC</span>
                      <span>{stat._avg.coinsPerLevel ? `${(stat._avg.coinsPerLevel).toFixed(1)} TC/lvl` : ''}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((stat._avg.soldPrice || 0) / (overallAvg || 1)) * 50)}%`,
                          backgroundColor: vocColor,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Min: {formatNumber(stat._min.soldPrice || 0)} TC</span>
                      <span>Max: {formatNumber(stat._max.soldPrice || 0)} TC</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

function MarketSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /></CardContent>
          </Card>
        ))}
      </section>
      <section>
        <Skeleton className="mb-4 h-7 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

export default function MarketPage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Market Analysis</h1>
        <p className="text-muted-foreground">Auction market statistics and price trends</p>
      </div>
      <Suspense fallback={<MarketSkeleton />}>
        <MarketContent />
      </Suspense>
    </div>
  );
}
