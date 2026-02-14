import { Suspense } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import MarketClient from './MarketClient';

export const metadata = {
  title: 'Market Analysis - RubinOT Stats',
  description: 'Auction market statistics and price trends for RubinOT.',
};

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
        <MarketClient />
      </Suspense>
    </div>
  );
}
