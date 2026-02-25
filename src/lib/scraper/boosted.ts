/**
 * Boosted creature & boss scraper for RubinOT.
 * Uses the JSON API at /api/boosted.
 * Still needs Brave Browser to bypass Cloudflare on initial navigation.
 */
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';

export interface BoostedData {
  creature: { id: number; name: string; looktype: number };
  boss: { id: number; name: string; looktype: number };
}

interface ApiBoostedResponse {
  boss: { id: number; name: string; looktype: number };
  monster: { id: number; name: string; looktype: number };
}

export async function fetchBoosted(page: Page): Promise<BoostedData> {
  const data = await page.evaluate(async () => {
    const res = await fetch('/api/boosted');
    if (!res.ok) throw new Error(`Boosted API ${res.status}: ${res.statusText}`);
    return res.json();
  }) as ApiBoostedResponse;

  return {
    creature: data.monster,
    boss: data.boss,
  };
}
