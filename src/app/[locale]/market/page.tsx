import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemMarketClient } from './ItemMarketClient';

export const metadata = {
  title: 'Item Market - RubinOT Stats',
  description: 'Player-to-player item marketplace for RubinOT.',
};

function ListingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function MarketPage() {
  const { getTranslations } = await import('next-intl/server');
  const t = await getTranslations('market');

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground">{t('subheading')}</p>
      </div>

      <Suspense fallback={<ListingsSkeleton />}>
        <ItemMarketClient />
      </Suspense>
    </div>
  );
}
