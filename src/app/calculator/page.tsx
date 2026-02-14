import { Suspense } from 'react';
import CalculatorClient from './CalculatorClient';

export const metadata = {
  title: 'Exercise Weapon Calculator - RubinOT Stats',
  description:
    'Calculate exercise weapon requirements for skill training on RubinOT. Find out how many weapons you need or how much skill you will gain.',
};

export default function CalculatorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Exercise Weapon Calculator</h1>
        <p className="text-muted-foreground">
          Calculate how many exercise weapons you need to reach your target skill,
          or how much skill you&apos;ll gain from a set of weapons. Uses RubinOT multiplier rates.
        </p>
      </div>
      <Suspense fallback={<div className="animate-pulse h-96 bg-card/50 rounded-lg" />}>
        <CalculatorClient />
      </Suspense>
    </div>
  );
}
