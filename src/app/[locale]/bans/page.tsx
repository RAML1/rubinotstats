import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/db/prisma';
import { mapBanReason } from '@/lib/utils/ban-rules';
import { BansClient } from './BansClient';

export const dynamic = 'force-dynamic';

async function getBansData() {
  const [bans, total] = await Promise.all([
    prisma.ban.findMany({
      where: { isActive: true },
      orderBy: { bannedAt: 'desc' },
    }),
    prisma.ban.count({ where: { isActive: true } }),
  ]);

  // Compute insights server-side
  const byReason: Record<string, number> = {};
  let permanent = 0;
  let temporary = 0;
  const byDate: Record<string, number> = {};

  for (const b of bans) {
    const reason = mapBanReason(b.reason) || 'Unknown';
    byReason[reason] = (byReason[reason] || 0) + 1;

    if (b.isPermanent) permanent++;
    else temporary++;

    if (b.bannedAt) {
      const dateKey = b.bannedAt.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }
  }

  return {
    bans: bans.map((b) => ({
      id: b.id,
      playerName: b.playerName,
      world: b.world,
      reason: mapBanReason(b.reason),
      bannedAt: b.bannedAt?.toISOString() ?? null,
      expiresAt: b.expiresAt?.toISOString() ?? null,
      isPermanent: b.isPermanent,
    })),
    total,
    insights: {
      byReason: Object.entries(byReason)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      permanent,
      temporary,
      byDate: Object.entries(byDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}

async function BansContent() {
  const data = await getBansData();

  return (
    <BansClient
      initialBans={data.bans}
      initialTotal={data.total}
      insights={data.insights}
    />
  );
}

function BansSkeleton() {
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

export default async function BansPage() {
  const { getTranslations } = await import('next-intl/server');
  const t = await getTranslations('bans');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t('subheading')}
        </p>
      </div>
      <Suspense fallback={<BansSkeleton />}>
        <BansContent />
      </Suspense>
    </div>
  );
}
