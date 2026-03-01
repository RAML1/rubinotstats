#!/usr/bin/env tsx
/**
 * Scrapes PvP kills from rubinot.com.br/api/deaths.
 *
 * Usage:
 *   pnpm scrape:deaths              # Scrape and save to DB
 *   pnpm scrape:deaths --no-db      # Just print the result
 */
import { PrismaClient } from '@prisma/client';
import { getBrowserContext, navigateWithCloudflare, closeBrowser } from '../src/lib/scraper/browser';
import { RUBINOT_URLS } from '../src/lib/utils/constants';
import { fetchAllPvpKills } from '../src/lib/scraper/deaths';
import type { BrowserName } from '../src/lib/scraper/browser';

const BROWSER: BrowserName = 'deaths';
const prisma = new PrismaClient();
const skipDb = process.argv.includes('--no-db');

async function main() {
  console.log('Launching browser for deaths scrape...');
  const context = await getBrowserContext({ headless: false, browser: BROWSER });
  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to base site first to bypass Cloudflare
    await navigateWithCloudflare(page, RUBINOT_URLS.base, 60_000);

    console.log('Fetching PvP kills from deaths API...');
    const kills = await fetchAllPvpKills(page);
    console.log(`\nTotal PvP kills found: ${kills.length}`);

    if (kills.length > 0) {
      console.log('\nSample kills:');
      kills.slice(0, 5).forEach(k => {
        console.log(`  ${k.killerName} killed ${k.victimName} (Lv ${k.victimLevel}) in ${k.world} at ${k.killedAt.toISOString()}`);
      });
      if (kills.length > 5) console.log(`  ... and ${kills.length - 5} more`);
    }

    if (!skipDb && kills.length > 0) {
      console.log('\nSaving to database...');
      let upserted = 0;

      for (const kill of kills) {
        try {
          await prisma.pvpKill.upsert({
            where: {
              killerName_victimName_killedAt: {
                killerName: kill.killerName,
                victimName: kill.victimName,
                killedAt: kill.killedAt,
              },
            },
            update: {
              victimLevel: kill.victimLevel,
              mostDamageBy: kill.mostDamageBy,
              mostDamageIsPlayer: kill.mostDamageIsPlayer,
              world: kill.world,
            },
            create: {
              killerName: kill.killerName,
              victimName: kill.victimName,
              victimLevel: kill.victimLevel,
              mostDamageBy: kill.mostDamageBy,
              mostDamageIsPlayer: kill.mostDamageIsPlayer,
              world: kill.world,
              killedAt: kill.killedAt,
            },
          });
          upserted++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('Unique constraint')) {
            console.warn(`  Warning: Failed to upsert kill ${kill.killerName} → ${kill.victimName}:`, msg);
          }
        }
      }

      console.log(`Saved ${upserted} PvP kills to database.`);

      // Backfill killer levels from highscore data using Tibia EXP formula
      console.log('\nBackfilling killer levels from highscore data...');
      const updated = await prisma.$executeRawUnsafe(`
        UPDATE pvp_kills pk
        SET killer_level = (
          SELECT GREATEST(1,
            FLOOR(POWER(CAST(he.score AS FLOAT) * 3.0 / 50.0, 1.0/3.0) + 2)::INTEGER
          )
          FROM highscore_entries he
          WHERE he.character_name = pk.killer_name
            AND he.category = 'Experience Points'
          ORDER BY he.captured_date DESC
          LIMIT 1
        )
        WHERE pk.killer_level IS NULL
      `);
      console.log(`Updated ${updated} kills with killer levels.`);
    }
  } finally {
    await prisma.$disconnect();
    await closeBrowser(BROWSER);
  }
}

main().catch((err) => {
  console.error('Deaths scraper failed:', err);
  prisma.$disconnect().then(() => closeBrowser(BROWSER)).finally(() => process.exit(1));
});
