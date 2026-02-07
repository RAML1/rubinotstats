#!/usr/bin/env tsx
/**
 * CLI script for scraping RubinOT sold auction history.
 *
 * Usage:
 *   pnpm scrape --auctions              # Scrape ALL sold auction history
 *   pnpm scrape --auctions --pages 5    # Scrape first 5 pages only
 *   pnpm scrape --auction 140700        # Scrape a single auction by ID
 *   pnpm scrape --headless              # Run in headless mode (may fail on Cloudflare)
 */
import * as fs from 'fs';
import * as path from 'path';
import { getBrowserContext, closeBrowser } from '../src/lib/scraper/browser';
import {
  scrapeAuctionHistory,
  scrapeSingleAuction,
  type ScrapedAuction,
} from '../src/lib/scraper/auctions';

// ── CLI arg parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const hasFlag = (flag: string) => args.includes(flag);

const scrapeAll = hasFlag('--auctions');
const singleId = getArg('--auction');
const headless = hasFlag('--headless');
const maxPages = getArg('--pages') ? parseInt(getArg('--pages')!, 10) : undefined;

if (!scrapeAll && !singleId) {
  console.log(`
RubinOT Sold Auction Scraper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage:
  pnpm scrape --auctions              Scrape ALL sold auction history (last 30 days)
  pnpm scrape --auctions --pages 5    Scrape first 5 pages only
  pnpm scrape --auction <id>          Scrape a single auction by ID
  pnpm scrape --headless              Run headless (add to any command above)

Output:
  data/auctions-YYYY-MM-DD.json          All sold auctions
  data/auction-<id>-YYYY-MM-DD.json      Single auction

Notes:
  - Only sold auctions (Winning Bid) are saved; unsold are skipped
  - Visits each auction detail page to get ALL 8 skills
  - Rate limited to 2s between requests
  - Uses non-headless browser by default to bypass Cloudflare

Examples:
  pnpm scrape --auctions
  pnpm scrape --auctions --pages 10
  pnpm scrape --auction 140700
`);
  process.exit(0);
}

// ── Main ───────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];
const dataDir = path.join(process.cwd(), 'data');

async function main() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('Launching browser...');
  const context = await getBrowserContext({ headless });
  const page = context.pages()[0] || (await context.newPage());

  try {
    if (singleId) {
      const auction = await scrapeSingleAuction(page, singleId);
      if (!auction) {
        console.error(`No auction found with ID ${singleId}`);
        process.exit(1);
      }

      const outFile = path.join(dataDir, `auction-${singleId}-${today}.json`);
      fs.writeFileSync(outFile, JSON.stringify(auction, null, 2), 'utf-8');
      console.log(`\nSaved to ${outFile}`);
      printAuctionTable(auction);
    } else {
      const auctions = await scrapeAuctionHistory(page, { maxPages });
      const outFile = path.join(dataDir, `auctions-${today}.json`);

      const output = {
        scrapedAt: new Date().toISOString(),
        source: 'pastcharactertrades',
        soldOnly: true,
        totalSold: auctions.length,
        auctions,
      };

      fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
      console.log(`\nSaved ${auctions.length} sold auctions to ${outFile}`);

      // Print first 3 as tables
      const preview = auctions.slice(0, 3);
      for (const a of preview) {
        printAuctionTable(a);
      }

      printSummary(auctions);
    }
  } finally {
    await closeBrowser();
  }
}

// ── Pretty output ──────────────────────────────────────────────────────

function printAuctionTable(a: ScrapedAuction) {
  const rows: [string, unknown][] = [
    ['externalId', a.externalId],
    ['characterName', a.characterName],
    ['level', a.level],
    ['vocation', a.vocation],
    ['gender', a.gender],
    ['world', a.world],
    ['auctionStart', a.auctionStart],
    ['auctionEnd', a.auctionEnd],
    ['soldPrice', a.soldPrice !== null ? `${a.soldPrice} TC` : null],
    ['coinsPerLevel', a.coinsPerLevel],
    // Skills
    ['magicLevel', a.magicLevel],
    ['fist', a.fist],
    ['club', a.club],
    ['sword', a.sword],
    ['axe', a.axe],
    ['distance', a.distance],
    ['shielding', a.shielding],
    ['fishing', a.fishing],
    // General stats
    ['hitPoints', a.hitPoints],
    ['mana', a.mana],
    ['capacity', a.capacity],
    ['speed', a.speed],
    ['experience', a.experience],
    ['creationDate', a.creationDate],
    ['achievementPoints', a.achievementPoints],
    ['mountsCount', a.mountsCount],
    ['outfitsCount', a.outfitsCount],
    ['titlesCount', a.titlesCount],
    ['linkedTasks', a.linkedTasks],
    ['dailyRewardStreak', a.dailyRewardStreak],
    // Charm
    ['charmExpansion', a.charmExpansion],
    ['charmPoints', a.charmPoints],
    ['unusedCharmPoints', a.unusedCharmPoints],
    ['spentCharmPoints', a.spentCharmPoints],
    // Prey & hunting
    ['preySlots', a.preySlots],
    ['preyWildcards', a.preyWildcards],
    ['huntingTaskPoints', a.huntingTaskPoints],
    // Hirelings
    ['hirelings', a.hirelings],
    ['hirelingJobs', a.hirelingJobs],
    // Items
    ['storeItemsCount', a.storeItemsCount],
    // Other
    ['bossPoints', a.bossPoints],
    ['blessingsCount', a.blessingsCount],
    ['exaltedDust', a.exaltedDust],
    ['gold', a.gold],
    ['bestiary', a.bestiary],
    ['url', a.url],
  ];

  console.log('\n┌──────────────────────┬──────────────────────────────────────');
  console.log('│ Column               │ Value');
  console.log('├──────────────────────┼──────────────────────────────────────');
  for (const [k, v] of rows) {
    console.log(`│ ${k.padEnd(21)}│ ${v ?? '—'}`);
  }
  console.log('└──────────────────────┴──────────────────────────────────────');
}

function printSummary(auctions: ScrapedAuction[]) {
  const vocCounts: Record<string, number> = {};
  const worldCounts: Record<string, number> = {};
  let totalPrice = 0;
  let priceCount = 0;

  for (const a of auctions) {
    if (a.vocation) vocCounts[a.vocation] = (vocCounts[a.vocation] || 0) + 1;
    if (a.world) worldCounts[a.world] = (worldCounts[a.world] || 0) + 1;
    if (a.soldPrice && a.soldPrice > 0) {
      totalPrice += a.soldPrice;
      priceCount++;
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sold Auction History Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total sold: ${auctions.length}
  Avg sale price: ${priceCount > 0 ? Math.round(totalPrice / priceCount) : 0} TC

  By Vocation:
${Object.entries(vocCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([v, c]) => `    ${v}: ${c}`)
  .join('\n')}

  Top Worlds:
${Object.entries(worldCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([w, c]) => `    ${w}: ${c}`)
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  closeBrowser().finally(() => process.exit(1));
});
