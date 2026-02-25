import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import prisma from '@/lib/db/prisma';
import { AuctionsClient } from './AuctionsClient';

export const dynamic = 'force-dynamic';

async function getAuctionData() {
  const [auctions, worlds, vocations] = await Promise.all([
    prisma.auction.findMany({
      orderBy: { soldPrice: 'desc' },
      take: 500,
    }),
    prisma.auction.findMany({
      select: { world: true },
      distinct: ['world'],
      where: { world: { not: null } },
    }),
    prisma.auction.findMany({
      select: { vocation: true },
      distinct: ['vocation'],
      where: { vocation: { not: null } },
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
  };
}

async function AuctionsContent({ initialSearch }: { initialSearch: string }) {
  const data = await getAuctionData();
  return (
    <AuctionsClient
      initialAuctions={data.auctions}
      worlds={data.worlds}
      vocations={data.vocations}
      initialSearch={initialSearch}
    />
  );
}

function AuctionsSkeleton() {
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

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const initialSearch = params.search || '';

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Auctions</h1>
        <p className="text-muted-foreground">Browse sold character auctions from RubinOT</p>
      </div>
      <Suspense fallback={<AuctionsSkeleton />}>
        <AuctionsContent initialSearch={initialSearch} />
      </Suspense>
    </div>
  );
}
