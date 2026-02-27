import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import CalculatorClient from './CalculatorClient';

export const metadata = {
  title: 'Exercise Weapon Calculator - RubinOT Stats',
  description:
    'Calculate exercise weapon requirements for skill training on RubinOT. Find out how many weapons you need or how much skill you will gain.',
};

export default async function CalculatorPage() {
  const t = await getTranslations('calculator');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('heading')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>
      <Suspense fallback={<div className="animate-pulse h-96 bg-card/50 rounded-lg" />}>
        <CalculatorClient />
      </Suspense>
    </div>
  );
}
