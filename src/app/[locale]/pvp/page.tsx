import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { PvpClient } from './PvpClient';

export const dynamic = 'force-dynamic';

async function getPvpData() {
  const kills = await prisma.pvpKill.findMany({
    orderBy: { killedAt: 'desc' },
  });

  const total = kills.length;

  // Top killers
  const killerCounts: Record<string, number> = {};
  const victimCounts: Record<string, number> = {};
  const worldCounts: Record<string, number> = {};
  const dateCounts: Record<string, number> = {};

  for (const k of kills) {
    killerCounts[k.killerName] = (killerCounts[k.killerName] || 0) + 1;
    victimCounts[k.victimName] = (victimCounts[k.victimName] || 0) + 1;
    worldCounts[k.world] = (worldCounts[k.world] || 0) + 1;

    const dateKey = k.killedAt.toISOString().split('T')[0];
    dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
  }

  const topKillers = Object.entries(killerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topVictims = Object.entries(victimCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byWorld = Object.entries(worldCounts)
    .map(([world, count]) => ({ world, count }))
    .sort((a, b) => b.count - a.count);

  const byDate = Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const uniqueKillers = Object.keys(killerCounts).length;
  const uniqueVictims = Object.keys(victimCounts).length;
  const mostActiveWorld = byWorld[0]?.world || '—';

  return {
    kills: kills.map((k) => ({
      id: k.id,
      killerName: k.killerName,
      killerLevel: k.killerLevel,
      victimName: k.victimName,
      victimLevel: k.victimLevel,
      mostDamageBy: k.mostDamageBy,
      mostDamageIsPlayer: k.mostDamageIsPlayer,
      world: k.world,
      killedAt: k.killedAt.toISOString(),
    })),
    stats: { total, uniqueKillers, uniqueVictims, mostActiveWorld },
    insights: { topKillers, topVictims, byWorld, byDate },
  };
}

async function PvpContent() {
  const data = await getPvpData();
  return (
    <PvpClient
      initialKills={data.kills}
      stats={data.stats}
      insights={data.insights}
    />
  );
}

function PvpSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default async function PvpPage() {
  const { getTranslations } = await import('next-intl/server');
  const t = await getTranslations('pvp');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t('subheading')}
        </p>
      </div>
      <Suspense fallback={<PvpSkeleton />}>
        <PvpContent />
      </Suspense>
    </div>
  );
}
