import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { BansClient } from './BansClient';

async function getBansData() {
  const [bans, total] = await Promise.all([
    prisma.ban.findMany({
      where: { isActive: true },
      orderBy: { bannedAt: 'desc' },
      take: 50,
    }),
    prisma.ban.count({ where: { isActive: true } }),
  ]);

  return {
    bans: bans.map((b) => ({
      id: b.id,
      playerName: b.playerName,
      world: b.world,
      reason: b.reason,
      bannedAt: b.bannedAt?.toISOString() ?? null,
      expiresAt: b.expiresAt?.toISOString() ?? null,
      isPermanent: b.isPermanent,
    })),
    total,
  };
}

async function BansContent() {
  const data = await getBansData();

  return (
    <BansClient
      initialBans={data.bans}
      initialTotal={data.total}
    />
  );
}

function BansSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function BansPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Active Bans</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Players currently banned on RubinOT
        </p>
      </div>
      <Suspense fallback={<BansSkeleton />}>
        <BansContent />
      </Suspense>
    </div>
  );
}
