#!/usr/bin/env tsx
/**
 * Scrapes recent transfers from rubinot.com.br/transfers.
 *
 * Usage:
 *   pnpm scrape:transfers              # Scrape and save to DB
 *   pnpm scrape:transfers --no-db      # Just print the result
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, navigateWithCloudflare, closeBrowser, sleep } from '../src/lib/scraper/browser';
import { RUBINOT_URLS } from '../src/lib/utils/constants';
import { scrapeTransfersPage } from '../src/lib/scraper/transfers';
import type { BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'transfers';
const prisma = new PrismaClient();
const skipDb = process.argv.includes('--no-db');

function parseDateStr(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  // RubinOT format: "DD/MM/YYYY HH:mm:ss"
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hour, min, sec] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
  }
  // Fallback
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log('Launching browser for transfers scrape...');
  const context = await getBrowserContext({ headless: false, browser: BROWSER });
  const page = context.pages()[0] || await context.newPage();

  try {
    const url = RUBINOT_URLS.base + RUBINOT_URLS.transfers;
    await navigateWithCloudflare(page, url, 60_000);
    await sleep(3000);

    const transfers = await scrapeTransfersPage(page);
    console.log(`\nScraped ${transfers.length} transfers from the page\n`);

    if (transfers.length > 0) {
      console.log('Sample transfers:');
      transfers.slice(0, 5).forEach(t => {
        console.log(`  ${t.playerName} (Lv ${t.level ?? '?'}) — ${t.fromWorld} → ${t.toWorld} — ${t.transferDate}`);
      });
      if (transfers.length > 5) console.log(`  ... and ${transfers.length - 5} more`);
    }

    if (!skipDb && transfers.length > 0) {
      console.log('\nSaving to database...');
      let upserted = 0;

      for (const transfer of transfers) {
        const transferDate = parseDateStr(transfer.transferDate);
        try {
          await prisma.transfer.upsert({
            where: {
              playerName_fromWorld_toWorld_transferDate: {
                playerName: transfer.playerName,
                fromWorld: transfer.fromWorld,
                toWorld: transfer.toWorld,
                transferDate: transferDate ?? new Date(0),
              },
            },
            update: {
              level: transfer.level,
            },
            create: {
              playerName: transfer.playerName,
              fromWorld: transfer.fromWorld,
              toWorld: transfer.toWorld,
              transferDate,
              level: transfer.level,
            },
          });
          upserted++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('Unique constraint')) {
            console.warn(`  Warning: Failed to upsert transfer for ${transfer.playerName}:`, msg);
          }
        }
      }

      console.log(`Saved ${upserted} transfers to database.`);
    }
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Transfers scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
