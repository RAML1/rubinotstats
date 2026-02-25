import { Suspense } from 'react';
import { unstable_cache } from 'next/cache';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import prisma from '@/lib/db/prisma';
import { computeValuations } from '@/lib/utils/valuation';
import { getSession } from '@/lib/auth-helpers';
import { isPremium } from '@/lib/utils/premium';
import { CurrentAuctionsClient } from './CurrentAuctionsClient';

export const dynamic = 'force-dynamic';

const getCurrentAuctionData = unstable_cache(
  async () => {
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

    // PREMIUM_GATE: Valuations are available to all users now.
    const valuations = await computeValuations(auctions);

    return {
      auctions: serialized,
      worlds: worlds.map((w) => w.world).filter(Boolean) as string[],
      vocations: vocations.map((v) => v.vocation).filter(Boolean) as string[],
      worldTypes: worldTypes.map((wt) => ({
        worldName: wt.worldName,
        pvpType: wt.pvpType,
        isRtc: wt.isRtc,
      })),
      valuations,
    };
  },
  ['current-auctions-data'],
  { revalidate: 120, tags: ['current-auctions'] } // Cache for 2 minutes
);

async function CurrentAuctionsContent({ initialSearch }: { initialSearch: string }) {
  const [data, session] = await Promise.all([
    getCurrentAuctionData(),
    getSession(),
  ]);

  const userIsPremium = session?.user
    ? isPremium({ premiumTier: session.user.premiumTier, premiumUntil: session.user.premiumUntil })
    : false;

  // Fetch active featured auctions
  const now = new Date();
  const featuredRows = await prisma.featuredAuction.findMany({
    where: { isActive: true, expiresAt: { gt: now } },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });

  const featuredAuctionIds = featuredRows.map((f) => ({
    auctionExternalId: f.auctionId,
    featuredId: f.id,
    userName: f.user.name,
    userImage: f.user.image,
    userId: f.userId,
  }));

  return (
    <CurrentAuctionsClient
      initialAuctions={data.auctions}
      worlds={data.worlds}
      vocations={data.vocations}
      worldTypes={data.worldTypes}
      valuations={userIsPremium ? data.valuations : {}}
      initialSearch={initialSearch}
      userIsPremium={userIsPremium}
      userId={session?.user?.id ?? null}
      featuredAuctionIds={featuredAuctionIds}
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
        <p className="text-xs text-muted-foreground/60 mt-1">Current bid values may differ from actual due to data loading delays</p>
      </div>
      <Suspense fallback={<CurrentAuctionsSkeleton />}>
        <CurrentAuctionsContent initialSearch={initialSearch} />
      </Suspense>
    </div>
  );
}
