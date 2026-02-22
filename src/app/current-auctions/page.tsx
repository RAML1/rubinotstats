import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import prisma from '@/lib/db/prisma';
import { CurrentAuctionsClient } from './CurrentAuctionsClient';

async function getCurrentAuctionData() {
  const [auctions, worlds, vocations, worldTypes] = await Promise.all([
    prisma.currentAuction.findMany({
      orderBy: { currentBid: 'desc' },
      take: 2000,
    }),
    prisma.currentAuction.findMany({
      select: { world: true },
      distinct: ['world'],
      where: { world: { not: null }, isActive: true },
    }),
    prisma.currentAuction.findMany({
      select: { vocation: true },
      distinct: ['vocation'],
      where: { vocation: { not: null }, isActive: true },
    }),
    prisma.worldType.findMany({
      orderBy: { worldName: 'asc' },
    }),
  ]);

  const serialized = auctions.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return {
    auctions: serialized,
    worlds: worlds.map((w) => w.world).filter(Boolean) as string[],
    vocations: vocations.map((v) => v.vocation).filter(Boolean) as string[],
    worldTypes: worldTypes.map((wt) => ({
      worldName: wt.worldName,
      pvpType: wt.pvpType,
      isRtc: wt.isRtc,
    })),
  };
}

async function CurrentAuctionsContent({ initialSearch }: { initialSearch: string }) {
  const data = await getCurrentAuctionData();
  return (
    <CurrentAuctionsClient
      initialAuctions={data.auctions}
      worlds={data.worlds}
      vocations={data.vocations}
      worldTypes={data.worldTypes}
      initialSearch={initialSearch}
    />
  );
}

function CurrentAuctionsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
      </div>
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-0">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function CurrentAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const initialSearch = params.search || '';

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Current Auctions</h1>
        <p className="text-muted-foreground">Live character auctions on RubinOT — track bids in real-time</p>
      </div>
      <Suspense fallback={<CurrentAuctionsSkeleton />}>
        <CurrentAuctionsContent initialSearch={initialSearch} />
      </Suspense>
    </div>
  );
}
