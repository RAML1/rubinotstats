import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { TransfersClient } from './TransfersClient';

export const dynamic = 'force-dynamic';

async function getTransfersData() {
  const [transfers, total, worlds] = await Promise.all([
    prisma.transfer.findMany({
      orderBy: { transferDate: 'desc' },
    }),
    prisma.transfer.count(),
    prisma.$queryRaw<{ world: string }[]>`
      SELECT DISTINCT unnest(ARRAY[from_world, to_world]) AS world
      FROM transfers
      ORDER BY world
    `,
  ]);

  // Compute insights server-side
  const arrivals: Record<string, number> = {};
  const departures: Record<string, number> = {};
  const routeCounts: Record<string, number> = {};
  const levelBuckets: Record<string, number> = {
    '1-99': 0,
    '100-499': 0,
    '500-999': 0,
    '1000+': 0,
  };

  for (const t of transfers) {
    arrivals[t.toWorld] = (arrivals[t.toWorld] || 0) + 1;
    departures[t.fromWorld] = (departures[t.fromWorld] || 0) + 1;

    const routeKey = `${t.fromWorld} → ${t.toWorld}`;
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;

    if (t.level != null) {
      if (t.level < 100) levelBuckets['1-99']++;
      else if (t.level < 500) levelBuckets['100-499']++;
      else if (t.level < 1000) levelBuckets['500-999']++;
      else levelBuckets['1000+']++;
    }
  }

  const allWorlds = new Set([...Object.keys(arrivals), ...Object.keys(departures)]);
  const worldFlow = Array.from(allWorlds)
    .map((world) => ({
      world,
      arrivals: arrivals[world] || 0,
      departures: departures[world] || 0,
      net: (arrivals[world] || 0) - (departures[world] || 0),
    }))
    .sort((a, b) => b.net - a.net);

  const topRoutes = Object.entries(routeCounts)
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const levelDistribution = Object.entries(levelBuckets)
    .map(([range, count]) => ({ range, count }));

  return {
    transfers: transfers.map((t) => ({
      id: t.id,
      playerName: t.playerName,
      fromWorld: t.fromWorld,
      toWorld: t.toWorld,
      level: t.level,
      vocation: t.vocation,
      transferDate: t.transferDate?.toISOString() ?? null,
    })),
    total,
    worlds: worlds.map((w) => w.world),
    insights: {
      worldFlow,
      topRoutes,
      levelDistribution,
    },
  };
}

async function TransfersContent() {
  const data = await getTransfersData();

  return (
    <TransfersClient
      initialTransfers={data.transfers}
      initialTotal={data.total}
      worlds={data.worlds}
      insights={data.insights}
    />
  );
}

function TransfersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function TransfersPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">World Transfers</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Recent character transfers between RubinOT worlds
        </p>
      </div>
      <Suspense fallback={<TransfersSkeleton />}>
        <TransfersContent />
      </Suspense>
    </div>
  );
}
