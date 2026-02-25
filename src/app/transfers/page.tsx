import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { TransfersClient } from './TransfersClient';

async function getTransfersData() {
  const [transfers, total, worlds] = await Promise.all([
    prisma.transfer.findMany({
      orderBy: { transferDate: 'desc' },
      take: 50,
    }),
    prisma.transfer.count(),
    prisma.$queryRaw<{ world: string }[]>`
      SELECT DISTINCT unnest(ARRAY[from_world, to_world]) AS world
      FROM transfers
      ORDER BY world
    `,
  ]);

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
  };
}

async function TransfersContent() {
  const data = await getTransfersData();

  return (
    <TransfersClient
      initialTransfers={data.transfers}
      initialTotal={data.total}
      worlds={data.worlds}
    />
  );
}

function TransfersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
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
