#!/usr/bin/env tsx
/**
 * Scrapes today's boosted creature and boss from /api/boosted.
 *
 * Usage:
 *   pnpm scrape:boosted              # Scrape and save to DB
 *   pnpm scrape:boosted --no-db      # Just print the result
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, navigateWithCloudflare, closeBrowser, sleep } from '../src/lib/scraper/browser';
import { RUBINOT_URLS } from '../src/lib/utils/constants';
import { fetchBoosted } from '../src/lib/scraper/boosted';
import type { BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'boosted';
const prisma = new PrismaClient();
const skipDb = process.argv.includes('--no-db');

async function main() {
  console.log('Launching browser for boosted scrape...');
  const context = await getBrowserContext({ headless: false, browser: BROWSER });
  const page = context.pages()[0] || await context.newPage();

  try {
    await navigateWithCloudflare(page, RUBINOT_URLS.base, 60_000);
    await sleep(2000);

    const data = await fetchBoosted(page);

    console.log(`\nBoosted Creature: ${data.creature.name} (looktype ${data.creature.looktype})`);
    console.log(`Boosted Boss:     ${data.boss.name} (looktype ${data.boss.looktype})`);

    if (!skipDb) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.boostedDaily.upsert({
        where: { date: today },
        update: {
          boostedCreature: data.creature.name,
          creatureLooktype: data.creature.looktype,
          boostedBoss: data.boss.name,
          bossLooktype: data.boss.looktype,
        },
        create: {
          date: today,
          boostedCreature: data.creature.name,
          creatureLooktype: data.creature.looktype,
          boostedBoss: data.boss.name,
          bossLooktype: data.boss.looktype,
        },
      });
      console.log('\nSaved to database.');
    }
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Boosted scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
