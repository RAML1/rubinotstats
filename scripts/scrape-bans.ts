#!/usr/bin/env tsx
/**
 * Scrapes active bans from rubinot.com.br/bans.
 *
 * Usage:
 *   pnpm scrape:bans              # Scrape and save to DB
 *   pnpm scrape:bans --no-db      # Just print the result
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, navigateWithCloudflare, closeBrowser, sleep } from '../src/lib/scraper/browser';
import { RUBINOT_URLS } from '../src/lib/utils/constants';
import { scrapeBansPage, scrapeAllBans } from '../src/lib/scraper/bans';
import type { BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'bans';
const prisma = new PrismaClient();
const skipDb = process.argv.includes('--no-db');

function parseDateStr(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // Try common formats: "Feb 25, 2026", "25/02/2026", "2026-02-25", etc.
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log('Launching browser for bans scrape...');
  const context = await getBrowserContext({ headless: false, browser: BROWSER });
  const page = context.pages()[0] || await context.newPage();

  try {
    const url = RUBINOT_URLS.base + RUBINOT_URLS.bans;
    await navigateWithCloudflare(page, url, 60_000);
    await sleep(3000);

    // Scrape default view first
    const { bans, totalActive } = await scrapeBansPage(page);
    console.log(`\nTotal active bans reported: ${totalActive}`);
    console.log(`Scraped ${bans.length} bans from the page\n`);

    if (bans.length > 0) {
      console.log('Sample bans:');
      bans.slice(0, 5).forEach(b => {
        console.log(`  ${b.playerName} — ${b.reason || 'N/A'} — ${b.bannedAt} — ${b.isPermanent ? 'PERMANENT' : b.expiresAt}`);
      });
      if (bans.length > 5) console.log(`  ... and ${bans.length - 5} more`);
    }

    if (!skipDb && bans.length > 0) {
      console.log('\nSaving to database...');
      let upserted = 0;

      for (const ban of bans) {
        const bannedAt = parseDateStr(ban.bannedAt);
        try {
          await prisma.ban.upsert({
            where: {
              playerName_bannedAt: {
                playerName: ban.playerName,
                bannedAt: bannedAt ?? new Date(0),
              },
            },
            update: {
              reason: ban.reason,
              expiresAt: parseDateStr(ban.expiresAt),
              isPermanent: ban.isPermanent,
              isActive: true,
            },
            create: {
              playerName: ban.playerName,
              reason: ban.reason,
              bannedAt,
              expiresAt: parseDateStr(ban.expiresAt),
              isPermanent: ban.isPermanent,
              isActive: true,
            },
          });
          upserted++;
        } catch (err: unknown) {
          // Duplicate or constraint error — skip
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('Unique constraint')) {
            console.warn(`  Warning: Failed to upsert ban for ${ban.playerName}:`, msg);
          }
        }
      }

      console.log(`Saved ${upserted} bans to database.`);
    }
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Bans scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
