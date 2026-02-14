/**
 * Auction history scraper for RubinOT character bazaar.
 * Scrapes pastcharactertrades — only keeps sold auctions (Winning Bid).
 * Visits each auction's detail page to get ALL 8 skills.
 */
import * as cheerio from 'cheerio';
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';
import { navigateWithCloudflare, rateLimit, getHealthyPage, sleep, type BrowserName } from './browser';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScrapedAuction {
  externalId: string;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  auctionStatus: string | null; // sold, cancelled, expired
  soldPrice: number | null;
  // Skills (all 8)
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;
  // General tab stats
  hitPoints: number | null;
  mana: number | null;
  capacity: number | null;
  speed: number | null;
  experience: string | null;
  creationDate: string | null;
  achievementPoints: number | null;
  mountsCount: number | null;
  outfitsCount: number | null;
  titlesCount: number | null;
  linkedTasks: number | null;
  // Charm
  charmExpansion: boolean | null;
  charmPoints: number | null;
  unusedCharmPoints: number | null;
  spentCharmPoints: number | null;
  // Prey & hunting
  preySlots: number | null;
  preyWildcards: number | null;
  huntingTaskPoints: number | null;
  // Hirelings
  hirelings: number | null;
  hirelingJobs: number | null;
  // Items
  hasLootPouch: boolean | null;
  storeItemsCount: number | null;
  // Other
  bossPoints: number | null;
  blessingsCount: number | null;
  exaltedDust: string | null;
  gold: number | null;
  bestiary: number | null;
  dailyRewardStreak: number | null;
  // Quest availability (true = quest NOT done, available for buyer)
  primalOrdealAvailable: boolean | null;
  soulWarAvailable: boolean | null;
  sanguineBloodAvailable: boolean | null;
  // Calculated
  coinsPerLevel: number | null;
  url: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function parseNumber(s: string | undefined): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

/**
 * Derive auction status from the bid label text.
 * "Winning Bid" → sold, "Cancelled" → cancelled, anything else → expired (no bids / minimum bid)
 */
function parseBidStatus(bidLabel: string): string {
  const lower = bidLabel.toLowerCase();
  if (lower.includes('winning')) return 'sold';
  if (lower.includes('cancel')) return 'cancelled';
  return 'expired';
}

// ── List page parser ───────────────────────────────────────────────────

interface ListAuction {
  externalId: string;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  auctionStatus: string | null;
  soldPrice: number | null;
  charmPoints: number | null;
  unusedCharmPoints: number | null;
  bossPoints: number | null;
  exaltedDust: string | null;
  gold: number | null;
  bestiary: number | null;
}

/**
 * Parse auction history list page. Returns all auctions with status.
 */
function parseAuctionListPage(html: string): ListAuction[] {
  const $ = cheerio.load(html);
  const auctions: ListAuction[] = [];

  $('div.Auction').each((_i, el) => {
    const auction = $(el);

    const bidRow = auction.find('.ShortAuctionDataBidRow');
    const bidLabel = bidRow.find('.ShortAuctionDataLabel').text().trim();

    const detailLink = auction.find('.AuctionCharacterName a').attr('href') || '';
    const idMatch = detailLink.match(/currentcharactertrades\/(\d+)/);
    const externalId = idMatch ? idMatch[1] : '';
    if (!externalId) return;

    const auctionStatus = parseBidStatus(bidLabel);
    const characterName = auction.find('.AuctionCharacterName a').text().trim();

    const headerText = auction.find('.AuctionHeader').text();
    const levelMatch = headerText.match(/Level:\s*(\d+)/);
    const vocMatch = headerText.match(/Vocation:\s*([^|]+)/);
    const genderMatch = headerText.match(/\|\s*(Male|Female)\s*\|/i);
    const worldMatch = headerText.match(/World:\s*(\S.*?)(?:\s*$|\n)/);

    const labels = auction.find('.ShortAuctionDataLabel');
    const values = auction.find('.ShortAuctionDataValue');
    let auctionStart: string | null = null;
    let auctionEnd: string | null = null;
    labels.each((j, lbl) => {
      const lt = $(lbl).text().trim();
      const vt = $(values.eq(j)).text().trim();
      if (lt.includes('Auction Start')) auctionStart = vt;
      if (lt.includes('Auction End')) auctionEnd = vt;
    });

    const bidValue = parseNumber(bidRow.find('.ShortAuctionDataValue b').text());
    const soldPrice = auctionStatus === 'sold' ? bidValue : null;

    let charmPoints: number | null = null;
    let unusedCharmPoints: number | null = null;
    let bossPoints: number | null = null;
    let exaltedDust: string | null = null;
    let gold: number | null = null;
    let bestiary: number | null = null;

    auction.find('.SpecialCharacterFeatures .Entry').each((_j, entry) => {
      const text = $(entry).text().trim();

      const charmMatch = text.match(/Total Charm Points:\s*(\d+)(?:.*Unused Charm Points:\s*(\d+))?/);
      if (charmMatch) {
        charmPoints = parseInt(charmMatch[1], 10);
        if (charmMatch[2]) unusedCharmPoints = parseInt(charmMatch[2], 10);
        return;
      }
      const bossMatch = text.match(/Total Boss Points:\s*(\d+)/);
      if (bossMatch) { bossPoints = parseInt(bossMatch[1], 10); return; }
      const dustMatch = text.match(/Exalted Dust\/Dust Limit:\s*(.+)/);
      if (dustMatch) { exaltedDust = dustMatch[1].trim(); return; }
      const goldMatch = text.match(/^(\d+)\s+Gold/);
      if (goldMatch) { gold = parseInt(goldMatch[1], 10); return; }
      const bestMatch = text.match(/Monsters in Bestiary completed:\s*(\d+)/);
      if (bestMatch) { bestiary = parseInt(bestMatch[1], 10); return; }
    });

    auctions.push({
      externalId,
      characterName,
      level: levelMatch ? parseInt(levelMatch[1], 10) : null,
      vocation: vocMatch ? vocMatch[1].trim() : null,
      gender: genderMatch ? genderMatch[1].trim() : null,
      world: worldMatch ? worldMatch[1].trim() : null,
      auctionStart,
      auctionEnd,
      auctionStatus,
      soldPrice,
      charmPoints,
      unusedCharmPoints,
      bossPoints,
      exaltedDust,
      gold,
      bestiary,
    });
  });

  return auctions;
}

// ── Detail page parser ─────────────────────────────────────────────────

interface DetailPageData {
  // Skills
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;
  // General tab
  hitPoints: number | null;
  mana: number | null;
  capacity: number | null;
  speed: number | null;
  experience: string | null;
  creationDate: string | null;
  achievementPoints: number | null;
  mountsCount: number | null;
  outfitsCount: number | null;
  titlesCount: number | null;
  linkedTasks: number | null;
  charmExpansion: boolean | null;
  spentCharmPoints: number | null;
  preySlots: number | null;
  preyWildcards: number | null;
  huntingTaskPoints: number | null;
  hirelings: number | null;
  hirelingJobs: number | null;
  hasLootPouch: boolean | null;
  storeItemsCount: number | null;
  blessingsCount: number | null;
  dailyRewardStreak: number | null;
  // Quest availability (true = NOT completed → available for buyer)
  primalOrdealAvailable: boolean | null;
  soulWarAvailable: boolean | null;
  sanguineBloodAvailable: boolean | null;
}

/**
 * Quest names to track — if NOT in the completed list, the quest is "available".
 * Uses case-insensitive substring matching.
 */
const TRACKED_QUESTS = {
  primalOrdealAvailable: ['primal ordeal'],
  soulWarAvailable: ['soul war'],
  sanguineBloodAvailable: ['sanguine', 'rotten blood'],
} as const;

/**
 * Parse the detail page General tab for all skills and stats.
 */
function parseDetailPage(html: string): DetailPageData {
  const $ = cheerio.load(html);

  const data: DetailPageData = {
    magicLevel: null, fist: null, club: null, sword: null,
    axe: null, distance: null, shielding: null, fishing: null,
    hitPoints: null, mana: null, capacity: null, speed: null,
    experience: null, creationDate: null, achievementPoints: null,
    mountsCount: null, outfitsCount: null, titlesCount: null,
    linkedTasks: null, charmExpansion: null, spentCharmPoints: null,
    preySlots: null, preyWildcards: null, huntingTaskPoints: null,
    hirelings: null, hirelingJobs: null, hasLootPouch: null, storeItemsCount: null,
    blessingsCount: null, dailyRewardStreak: null,
    primalOrdealAvailable: null, soulWarAvailable: null, sanguineBloodAvailable: null,
  };

  // Skills from the skill table (td.LabelColumn > b + td.LevelColumn)
  const skillMap: Record<string, keyof DetailPageData> = {
    'magic level': 'magicLevel',
    'fist fighting': 'fist',
    'club fighting': 'club',
    'sword fighting': 'sword',
    'axe fighting': 'axe',
    'distance fighting': 'distance',
    'shielding': 'shielding',
    'fishing': 'fishing',
  };

  $('td.LabelColumn b').each((_i, el) => {
    const name = $(el).text().trim().toLowerCase();
    const key = skillMap[name];
    if (key) {
      const valueCell = $(el).closest('tr').find('td.LevelColumn').text().trim();
      const value = parseInt(valueCell, 10);
      if (!isNaN(value)) (data as any)[key] = value;
    }
  });

  // General stats from span.LabelV + sibling div
  const labelMap: Record<string, { key: keyof DetailPageData; type: 'number' | 'string' | 'boolean' }> = {
    'hit points:': { key: 'hitPoints', type: 'number' },
    'mana:': { key: 'mana', type: 'number' },
    'capacity:': { key: 'capacity', type: 'number' },
    'speed:': { key: 'speed', type: 'number' },
    'blessings:': { key: 'blessingsCount', type: 'number' },
    'mounts:': { key: 'mountsCount', type: 'number' },
    'outfits:': { key: 'outfitsCount', type: 'number' },
    'titles:': { key: 'titlesCount', type: 'number' },
    'linked tasks:': { key: 'linkedTasks', type: 'number' },
    'creation date:': { key: 'creationDate', type: 'string' },
    'experience:': { key: 'experience', type: 'string' },
    'achievement points:': { key: 'achievementPoints', type: 'number' },
    'charm expansion:': { key: 'charmExpansion', type: 'boolean' },
    'spent charm points:': { key: 'spentCharmPoints', type: 'number' },
    'permanent prey slots:': { key: 'preySlots', type: 'number' },
    'prey wildcards:': { key: 'preyWildcards', type: 'number' },
    'hunting task points:': { key: 'huntingTaskPoints', type: 'number' },
    'hirelings:': { key: 'hirelings', type: 'number' },
    'hireling jobs:': { key: 'hirelingJobs', type: 'number' },
    'daily reward streak:': { key: 'dailyRewardStreak', type: 'number' },
  };

  $('span.LabelV').each((_i, el) => {
    const label = $(el).text().trim().toLowerCase();
    const mapping = labelMap[label];
    if (!mapping) return;

    const valueDiv = $(el).siblings('div').first().text().trim();

    if (mapping.type === 'number') {
      const cleaned = valueDiv.replace(/[^0-9-]/g, '');
      const num = parseInt(cleaned, 10);
      if (!isNaN(num)) (data as any)[mapping.key] = num;
    } else if (mapping.type === 'boolean') {
      (data as any)[mapping.key] = valueDiv.toLowerCase().includes('yes');
    } else {
      (data as any)[mapping.key] = valueDiv || null;
    }
  });

  // Store items — count + check for specific items (Loot Pouch, etc.)
  const storeBlock = $('#StoreItemSummary, div.CharacterDetailsBlock').filter((_i, el) => {
    return $(el).find('.Text').text().includes('Store Item Summary');
  });
  if (storeBlock.length) {
    const resultsText = storeBlock.text();
    const resultsMatch = resultsText.match(/Results:\s*(\d+)/);
    if (resultsMatch) {
      data.storeItemsCount = parseInt(resultsMatch[1], 10);
    }
    // Check for Loot Pouch in the item list
    const storeText = storeBlock.text().toLowerCase();
    data.hasLootPouch = storeText.includes('loot pouch');
  }

  // Completed Quest Lines — collect all quest names from the section
  const questBlock = $('#CompletedQuestLines');
  if (questBlock.length) {
    const completedQuests: string[] = [];
    questBlock.find('table.TableContent tr.Odd td, table.TableContent tr.Even td').each((_i, el) => {
      const name = $(el).text().trim().toLowerCase();
      if (name && name !== 'quest line names') completedQuests.push(name);
    });

    // "available" = quest NOT in the completed list (buyer can still do it)
    for (const [field, patterns] of Object.entries(TRACKED_QUESTS)) {
      const completed = completedQuests.some((q) =>
        patterns.some((p) => q.includes(p))
      );
      (data as any)[field] = !completed;
    }
  }

  return data;
}

// ── Pagination ─────────────────────────────────────────────────────────

export function getTotalPages(html: string): number {
  const $ = cheerio.load(html);
  let maxPage = 1;
  $('a[href*="currentpage"]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/currentpage=(\d+)/);
    if (match) {
      const p = parseInt(match[1], 10);
      if (p > maxPage) maxPage = p;
    }
  });
  return maxPage;
}

// ── Full scraper ───────────────────────────────────────────────────────

export interface ScrapeOptions {
  maxPages?: number;
  maxAuctions?: number;
  skipExternalIds?: Set<string>;
  onAuction?: (auction: ScrapedAuction) => Promise<void>;
  browserName?: BrowserName;
}

/**
 * Scrape sold auction history. Processes page-by-page: for each list page,
 * immediately scrapes detail pages for new auctions before moving to the
 * next list page. Stops once maxAuctions new auctions have been scraped.
 * Recovers automatically if the browser context dies (Cloudflare, crash, etc.).
 */
export async function scrapeAuctionHistory(
  page: Page,
  opts: ScrapeOptions = {},
): Promise<ScrapedAuction[]> {
  const baseUrl = `${RUBINOT_URLS.base}${RUBINOT_URLS.pastAuctions}`;
  const fullAuctions: ScrapedAuction[] = [];
  let scraped = 0;
  let skippedTotal = 0;
  const browserName = opts.browserName ?? 'auctions';

  // Mutable page ref — may be replaced if browser context dies
  let currentPage = page;

  // Fetch first page to get total page count
  console.log(`Fetching page 1: ${baseUrl}`);
  try {
    await navigateWithCloudflare(currentPage, baseUrl);
    await sleep(1200 + Math.floor(Math.random() * 1800));
  } catch {
    console.error('  Page died on first fetch — recovering browser...');
    await rateLimit('slow');
    currentPage = await getHealthyPage(browserName);
    await navigateWithCloudflare(currentPage, baseUrl);
    await sleep(1200 + Math.floor(Math.random() * 1800));
  }

  const firstPageHtml = await currentPage.content();
  const totalPages = opts.maxPages
    ? Math.min(getTotalPages(firstPageHtml), opts.maxPages)
    : getTotalPages(firstPageHtml);

  // Process first page
  const firstPageAuctions = parseAuctionListPage(firstPageHtml);
  const newOnFirst = opts.skipExternalIds
    ? firstPageAuctions.filter((a) => !opts.skipExternalIds!.has(a.externalId))
    : firstPageAuctions;
  const skippedFirst = firstPageAuctions.length - newOnFirst.length;
  skippedTotal += skippedFirst;

  console.log(`Page 1: ${firstPageAuctions.length} sold auctions (${newOnFirst.length} new, ${skippedFirst} skipped), ${totalPages} total pages`);

  // Scrape details for new auctions on page 1
  for (const a of newOnFirst) {
    if (opts.maxAuctions && scraped >= opts.maxAuctions) break;
    scraped++;
    await rateLimit();
    const detailUrl = `${RUBINOT_URLS.base}/?currentcharactertrades/${a.externalId}`;
    const target = opts.maxAuctions ?? '?';
    console.log(`  [${scraped}/${target}] ${a.characterName} (${detailUrl})`);

    const auction = await scrapeAuctionDetail(currentPage, a, detailUrl, browserName);
    if (opts.onAuction) await opts.onAuction(auction);
    fullAuctions.push(auction);
  }

  // Track consecutive fully-scraped pages to detect the end of new data
  // When --count is specified, don't early-stop (user wants to go deeper into history)
  let consecutiveSkippedPages = newOnFirst.length === 0 && firstPageAuctions.length > 0 ? 1 : 0;
  const MAX_CONSECUTIVE_SKIPS = opts.maxAuctions ? Infinity : 3;

  // Process remaining pages
  for (let p = 2; p <= totalPages; p++) {
    if (opts.maxAuctions && scraped >= opts.maxAuctions) break;
    if (consecutiveSkippedPages >= MAX_CONSECUTIVE_SKIPS) {
      console.log(`\n${MAX_CONSECUTIVE_SKIPS} consecutive pages with no new auctions — stopping.`);
      break;
    }

    await rateLimit();
    const pageUrl = `${RUBINOT_URLS.base}/?subtopic=pastcharactertrades&currentpage=${p}`;
    console.log(`\nFetching page ${p}/${totalPages}...`);

    try {
      await navigateWithCloudflare(currentPage, pageUrl);
      await sleep(800 + Math.floor(Math.random() * 1200));
      const html = await currentPage.content();
      const pageAuctions = parseAuctionListPage(html);
      const newOnPage = opts.skipExternalIds
        ? pageAuctions.filter((a) => !opts.skipExternalIds!.has(a.externalId))
        : pageAuctions;
      const skippedOnPage = pageAuctions.length - newOnPage.length;
      skippedTotal += skippedOnPage;

      console.log(`  Page ${p}: ${pageAuctions.length} sold (${newOnPage.length} new, ${skippedOnPage} skipped)`);

      if (newOnPage.length === 0 && pageAuctions.length > 0) {
        consecutiveSkippedPages++;
        console.log(`  No new auctions (${consecutiveSkippedPages}/${MAX_CONSECUTIVE_SKIPS} consecutive skips)`);
        continue;
      }
      consecutiveSkippedPages = 0; // Reset when we find new auctions

      // Immediately scrape details for new auctions on this page
      for (const a of newOnPage) {
        if (opts.maxAuctions && scraped >= opts.maxAuctions) break;
        scraped++;
        await rateLimit();
        const detailUrl = `${RUBINOT_URLS.base}/?currentcharactertrades/${a.externalId}`;
        const target = opts.maxAuctions ?? '?';
        console.log(`  [${scraped}/${target}] ${a.characterName} (${detailUrl})`);

        const auction = await scrapeAuctionDetail(currentPage, a, detailUrl, browserName);
        if (opts.onAuction) await opts.onAuction(auction);
        fullAuctions.push(auction);
      }
    } catch (err) {
      console.error(`  Failed page ${p} — recovering browser...`);
      try {
        currentPage = await getHealthyPage(browserName);
      } catch {
        // Will be recovered on next page
      }
    }
  }

  if (skippedTotal > 0) console.log(`\nSkipped ${skippedTotal} already-scraped auctions total`);
  console.log(`Scraped ${fullAuctions.length} new auctions`);

  return fullAuctions;
}

/**
 * Scrape a single auction's detail page and merge with list data.
 */
async function scrapeAuctionDetail(
  page: Page,
  a: ListAuction,
  detailUrl: string,
  browserName: BrowserName = 'chromium',
): Promise<ScrapedAuction> {
  let detail: DetailPageData = {
    magicLevel: null, fist: null, club: null, sword: null,
    axe: null, distance: null, shielding: null, fishing: null,
    hitPoints: null, mana: null, capacity: null, speed: null,
    experience: null, creationDate: null, achievementPoints: null,
    mountsCount: null, outfitsCount: null, titlesCount: null,
    linkedTasks: null, charmExpansion: null, spentCharmPoints: null,
    preySlots: null, preyWildcards: null, huntingTaskPoints: null,
    hirelings: null, hirelingJobs: null, hasLootPouch: null, storeItemsCount: null,
    blessingsCount: null, dailyRewardStreak: null,
    primalOrdealAvailable: null, soulWarAvailable: null, sanguineBloodAvailable: null,
  };

  try {
    await navigateWithCloudflare(page, detailUrl);
    await sleep(800 + Math.floor(Math.random() * 1200));
    const detailHtml = await page.content();
    detail = parseDetailPage(detailHtml);
  } catch (err) {
    console.error(`    Failed to fetch details for ${a.characterName} — skipping detail`);
  }

  const coinsPerLevel =
    a.soldPrice && a.level && a.level > 0
      ? Math.round((a.soldPrice / a.level) * 100) / 100
      : null;

  return {
    externalId: a.externalId,
    characterName: a.characterName,
    level: a.level,
    vocation: a.vocation,
    gender: a.gender,
    world: a.world,
    auctionStart: a.auctionStart,
    auctionEnd: a.auctionEnd,
    auctionStatus: a.auctionStatus,
    soldPrice: a.soldPrice,
    ...detail,
    charmPoints: a.charmPoints,
    unusedCharmPoints: a.unusedCharmPoints,
    bossPoints: a.bossPoints,
    exaltedDust: a.exaltedDust,
    gold: a.gold,
    bestiary: a.bestiary,
    coinsPerLevel,
    url: detailUrl,
  };
}

/**
 * Scrape a single auction by ID (detail page).
 */
export async function scrapeSingleAuction(
  page: Page,
  auctionId: string,
): Promise<ScrapedAuction | null> {
  const detailUrl = `${RUBINOT_URLS.base}/?currentcharactertrades/${auctionId}`;
  console.log(`Fetching auction ${auctionId}: ${detailUrl}`);
  await navigateWithCloudflare(page, detailUrl);
  await sleep(1200 + Math.floor(Math.random() * 1800));

  const html = await page.content();
  const $ = cheerio.load(html);

  // Parse the single auction div on the detail page
  const auctionEl = $('div.Auction');
  if (!auctionEl.length) return null;

  const headerText = auctionEl.find('.AuctionHeader').text();
  // Detail page has no <a> inside AuctionCharacterName, list page does
  const characterName =
    auctionEl.find('.AuctionCharacterName a').text().trim() ||
    auctionEl.find('.AuctionCharacterName').text().trim();
  const levelMatch = headerText.match(/Level:\s*(\d+)/);
  const vocMatch = headerText.match(/Vocation:\s*([^|]+)/);
  const genderMatch = headerText.match(/\|\s*(Male|Female)\s*\|/i);
  const worldMatch = headerText.match(/World:\s*(\S.*?)(?:\s*$|\n)/);

  const bidRow = auctionEl.find('.ShortAuctionDataBidRow');
  const bidLabel = bidRow.find('.ShortAuctionDataLabel').text().trim();
  const bidValue = parseNumber(bidRow.find('.ShortAuctionDataValue b').text());
  const auctionStatus = parseBidStatus(bidLabel);
  const soldPrice = auctionStatus === 'sold' ? bidValue : null;

  const labels = auctionEl.find('.ShortAuctionDataLabel');
  const values = auctionEl.find('.ShortAuctionDataValue');
  let auctionStart: string | null = null;
  let auctionEnd: string | null = null;
  labels.each((j, lbl) => {
    const lt = $(lbl).text().trim();
    const vt = $(values.eq(j)).text().trim();
    if (lt.includes('Auction Start')) auctionStart = vt;
    if (lt.includes('Auction End')) auctionEnd = vt;
  });

  let charmPoints: number | null = null;
  let unusedCharmPoints: number | null = null;
  let bossPoints: number | null = null;
  let exaltedDust: string | null = null;
  let gold: number | null = null;
  let bestiary: number | null = null;

  auctionEl.find('.SpecialCharacterFeatures .Entry').each((_j, entry) => {
    const text = $(entry).text().trim();
    const charmMatch = text.match(/Total Charm Points:\s*(\d+)(?:.*Unused Charm Points:\s*(\d+))?/);
    if (charmMatch) {
      charmPoints = parseInt(charmMatch[1], 10);
      if (charmMatch[2]) unusedCharmPoints = parseInt(charmMatch[2], 10);
      return;
    }
    const bossMatch = text.match(/Total Boss Points:\s*(\d+)/);
    if (bossMatch) { bossPoints = parseInt(bossMatch[1], 10); return; }
    const dustMatch = text.match(/Exalted Dust\/Dust Limit:\s*(.+)/);
    if (dustMatch) { exaltedDust = dustMatch[1].trim(); return; }
    const goldMatch = text.match(/^(\d+)\s+Gold/);
    if (goldMatch) { gold = parseInt(goldMatch[1], 10); return; }
    const bestMatch = text.match(/Monsters in Bestiary completed:\s*(\d+)/);
    if (bestMatch) { bestiary = parseInt(bestMatch[1], 10); return; }
  });

  const detail = parseDetailPage(html);
  const level = levelMatch ? parseInt(levelMatch[1], 10) : null;

  const coinsPerLevel =
    soldPrice && level && level > 0
      ? Math.round((soldPrice / level) * 100) / 100
      : null;

  return {
    externalId: auctionId,
    characterName,
    level,
    vocation: vocMatch ? vocMatch[1].trim() : null,
    gender: genderMatch ? genderMatch[1].trim() : null,
    world: worldMatch ? worldMatch[1].trim() : null,
    auctionStart,
    auctionEnd,
    auctionStatus,
    soldPrice,
    ...detail,
    charmPoints,
    unusedCharmPoints,
    bossPoints,
    exaltedDust,
    gold,
    bestiary,
    coinsPerLevel,
    url: detailUrl,
  };
}
