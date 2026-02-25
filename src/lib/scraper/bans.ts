/**
 * Bans scraper for RubinOT.
 * Scrapes the /bans page via HTML parsing (no JSON API available yet).
 * Requires Brave Browser to bypass Cloudflare.
 */
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';
import { rateLimit, sleep } from './browser';

export interface ScrapedBan {
  playerName: string;
  reason: string | null;
  bannedAt: string | null;
  expiresAt: string | null;
  isPermanent: boolean;
}

/**
 * Scrape bans from the current page.
 * Returns the rows visible on the page.
 */
export async function scrapeBansPage(page: Page): Promise<{ bans: ScrapedBan[]; totalActive: number }> {
  return page.evaluate(() => {
    const totalMatch = document.body.innerText.match(/Total de bans activos:\s*([\d.,]+)/);
    const totalActive = totalMatch ? parseInt(totalMatch[1].replace(/[.,]/g, ''), 10) : 0;

    const rows = document.querySelectorAll('table tbody tr');
    const bans: ScrapedBan[] = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;

      const playerName = cells[0].textContent?.trim() || '';
      const reason = cells[1].textContent?.trim() || null;
      const bannedAt = cells[2].textContent?.trim() || null;
      const expiresText = cells[3].textContent?.trim() || '';
      const isPermanent = expiresText.toLowerCase().includes('permanente');

      bans.push({
        playerName,
        reason,
        bannedAt,
        expiresAt: isPermanent ? null : expiresText || null,
        isPermanent,
      });
    });

    return { bans, totalActive };
  });
}

/**
 * Scrape all bans by selecting each world filter.
 * The page shows 50 per load but we can filter by world.
 */
export async function scrapeAllBans(
  page: Page,
  opts: { onBatch?: (bans: ScrapedBan[], world: string) => Promise<void> } = {},
): Promise<ScrapedBan[]> {
  const allBans: ScrapedBan[] = [];

  // First get the default view (all worlds)
  const { bans, totalActive } = await scrapeBansPage(page);
  console.log(`  Total active bans: ${totalActive}`);
  console.log(`  Scraped ${bans.length} bans from default view`);
  allBans.push(...bans);
  if (opts.onBatch) await opts.onBatch(bans, 'All');

  // Get list of world options from the select dropdown
  const worldOptions = await page.evaluate(() => {
    const select = document.querySelector('select');
    if (!select) return [];
    return Array.from(select.options)
      .filter(o => o.value !== 'all')
      .map(o => ({ value: o.value, name: o.textContent?.trim() || '' }));
  });

  // Select each world to get more bans
  for (const world of worldOptions) {
    await rateLimit('fast');
    await page.selectOption('select', world.value);
    await sleep(2000); // wait for page update

    const { bans: worldBans } = await scrapeBansPage(page);
    console.log(`  ${world.name}: ${worldBans.length} bans`);

    // Only add bans not already seen
    const existingNames = new Set(allBans.map(b => b.playerName + b.bannedAt));
    const newBans = worldBans.filter(b => !existingNames.has(b.playerName + b.bannedAt));
    allBans.push(...newBans);
    if (opts.onBatch && newBans.length > 0) await opts.onBatch(newBans, world.name);
  }

  return allBans;
}
