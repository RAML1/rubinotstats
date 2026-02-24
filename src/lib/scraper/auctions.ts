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
  // Skill percentages (progress to next level)
  magicLevelPct: number | null;
  fistPct: number | null;
  clubPct: number | null;
  swordPct: number | null;
  axePct: number | null;
  distancePct: number | null;
  shieldingPct: number | null;
  fishingPct: number | null;
  // Outfit image
  outfitImageUrl: string | null;
  // Gems (JSON string)
  gems: string | null;
  // Weekly task expansion
  weeklyTaskExpansion: boolean | null;
  // Battle Pass Deluxe
  battlePassDeluxe: boolean | null;
  // Display items (JSON string of image URLs)
  displayItems: string | null;
  // Outfit and mount names (JSON strings)
  outfitNames: string | null;
  mountNames: string | null;
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
  // Skill percentages
  magicLevelPct: number | null;
  fistPct: number | null;
  clubPct: number | null;
  swordPct: number | null;
  axePct: number | null;
  distancePct: number | null;
  shieldingPct: number | null;
  fishingPct: number | null;
  // Outfit image
  outfitImageUrl: string | null;
  // Gems (JSON string)
  gems: string | null;
  // Weekly task expansion
  weeklyTaskExpansion: boolean | null;
  // Battle Pass Deluxe
  battlePassDeluxe: boolean | null;
  // Display items (JSON string)
  displayItems: string | null;
  // Outfit and mount names (JSON strings)
  outfitNames: string | null;
  mountNames: string | null;
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
    magicLevelPct: null, fistPct: null, clubPct: null, swordPct: null,
    axePct: null, distancePct: null, shieldingPct: null, fishingPct: null,
    outfitImageUrl: null, gems: null, weeklyTaskExpansion: null, battlePassDeluxe: null,
    displayItems: null, outfitNames: null, mountNames: null,
  };

  // Skills from the skill table (td.LabelColumn > b + td.LevelColumn + td.PercentageColumn)
  const skillMap: Record<string, { level: keyof DetailPageData; pct: keyof DetailPageData }> = {
    'magic level': { level: 'magicLevel', pct: 'magicLevelPct' },
    'fist fighting': { level: 'fist', pct: 'fistPct' },
    'club fighting': { level: 'club', pct: 'clubPct' },
    'sword fighting': { level: 'sword', pct: 'swordPct' },
    'axe fighting': { level: 'axe', pct: 'axePct' },
    'distance fighting': { level: 'distance', pct: 'distancePct' },
    'shielding': { level: 'shielding', pct: 'shieldingPct' },
    'fishing': { level: 'fishing', pct: 'fishingPct' },
  };

  $('td.LabelColumn b').each((_i, el) => {
    const name = $(el).text().trim().toLowerCase();
    const mapping = skillMap[name];
    if (mapping) {
      const row = $(el).closest('tr');
      const valueCell = row.find('td.LevelColumn').text().trim();
      const value = parseInt(valueCell, 10);
      if (!isNaN(value)) (data as any)[mapping.level] = value;
      // Extract percentage from PercentageColumn
      const pctText = row.find('td.PercentageColumn .PercentageString').text().trim();
      const pctMatch = pctText.match(/([\d.]+)/);
      if (pctMatch) {
        const pctVal = parseFloat(pctMatch[1]);
        if (!isNaN(pctVal)) (data as any)[mapping.pct] = pctVal;
      }
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
    'permanent weekly task expansion:': { key: 'weeklyTaskExpansion', type: 'boolean' },
    'battle pass deluxe:': { key: 'battlePassDeluxe', type: 'boolean' },
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
    // Check for Loot Pouch in item title attributes (names are in title, not text)
    let hasLootPouch = false;
    storeBlock.find('.CVIcon').each((_j, iconEl) => {
      const title = $(iconEl).attr('title') || '';
      if (title.toLowerCase().includes('loot pouch')) hasLootPouch = true;
    });
    data.hasLootPouch = hasLootPouch;
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

  // Outfit image URL — resolve relative paths to absolute
  const outfitImg = $('img.AuctionOutfitImage').attr('src');
  if (outfitImg) {
    if (outfitImg.startsWith('http')) {
      data.outfitImageUrl = outfitImg;
    } else {
      // Resolve relative path (e.g. "./AnimatedOutfits/...") to absolute
      const cleaned = outfitImg.replace(/^\.\//, '');
      data.outfitImageUrl = `${RUBINOT_URLS.base}/${cleaned}`;
    }
  }

  // Gems — parse from #RevealedGems section
  const gemsContainer = $('#RevealedGems');
  if (gemsContainer.length) {
    const gemsList: { type: string; mods: string[] }[] = [];
    gemsContainer.find('.Gem').each((_i, gemEl) => {
      const gemType = $(gemEl).attr('title') || $(gemEl).find('.GemName').text().trim() || 'Unknown';
      const mods: string[] = [];
      $(gemEl).find('.ModEffectRow, .ModEffect').each((_j, modEl) => {
        const modText = $(modEl).text().trim();
        if (modText) mods.push(modText);
      });
      gemsList.push({ type: gemType, mods });
    });
    if (gemsList.length > 0) {
      data.gems = JSON.stringify(gemsList);
    }
  }

  // Display items — the 4 items shown on the auction card
  // Extract URL, item name, and tier from each .CVIcon container
  const displayItems: { url: string; name: string; tier: number }[] = [];
  $('.AuctionItemsViewBox .CVIcon.CVIconObject').each((_i, el) => {
    const img = $(el).find('img').first();
    const src = img.attr('src');
    if (!src) return;
    const title = $(el).attr('title') || '';
    // Parse tier from title like "Zaoan helmet (tier 2)"
    const tierMatch = title.match(/\(tier\s+(\d+)\)/i);
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 0;
    // Item name without the tier suffix
    const name = title.replace(/\s*\(tier\s+\d+\)/i, '').trim();
    displayItems.push({ url: src, name, tier });
  });
  if (displayItems.length > 0) {
    data.displayItems = JSON.stringify(displayItems);
  }

  // Outfit names — from div.CVIcon[title] inside tr.tmp-container-Outfits
  // Structure: <div class="CVIcon" title="Citizen (Base)"><img ...></div>
  const outfitNames: string[] = [];
  $('tr.tmp-container-Outfits div.CVIcon').each((_i, el) => {
    const title = $(el).attr('title');
    if (title) outfitNames.push(title);
  });
  // Fallback: find section by header text and scan CVIcon titles
  if (outfitNames.length === 0) {
    $('div.CaptionInnerContainer').each((_i, el) => {
      const headerText = $(el).find('.Text').text().trim();
      if (headerText === 'Outfits') {
        const block = $(el).closest('.TableContainer, td').first();
        block.find('div.CVIcon').each((_j, iconEl) => {
          const title = $(iconEl).attr('title');
          if (title) outfitNames.push(title);
        });
      }
    });
  }
  if (outfitNames.length > 0) {
    data.outfitNames = JSON.stringify(outfitNames);
  }

  // Mount names — from div.CVIcon[title] inside tr.tmp-container-Mounts
  const mountNames: string[] = [];
  $('tr.tmp-container-Mounts div.CVIcon').each((_i, el) => {
    const title = $(el).attr('title');
    if (title) mountNames.push(title);
  });
  if (mountNames.length === 0) {
    $('div.CaptionInnerContainer').each((_i, el) => {
      const headerText = $(el).find('.Text').text().trim();
      if (headerText === 'Mounts') {
        const block = $(el).closest('.TableContainer, td').first();
        block.find('div.CVIcon').each((_j, iconEl) => {
          const title = $(iconEl).attr('title');
          if (title) mountNames.push(title);
        });
      }
    });
  }
  if (mountNames.length > 0) {
    data.mountNames = JSON.stringify(mountNames);
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
 * Scrape sold auction history using parallel tabs for detail pages.
 * Tab 0 browses list pages sequentially. When new auctions are found,
 * tabs 1–DETAIL_TABS blast all detail pages in parallel (like highscores).
 */
export async function scrapeAuctionHistory(
  page: Page,
  opts: ScrapeOptions = {},
): Promise<ScrapedAuction[]> {
  const DETAIL_TABS = 10; // parallel tabs for detail pages
  const baseUrl = `${RUBINOT_URLS.base}${RUBINOT_URLS.pastAuctions}`;
  const fullAuctions: ScrapedAuction[] = [];
  let scraped = 0;
  let skippedTotal = 0;
  const browserName = opts.browserName ?? 'auctions';

  // Tab 0 = list page browser, tabs 1..N = detail page pool
  let listPage = page;
  const context = page.context();
  const detailTabs: Page[] = [];
  for (let i = 0; i < DETAIL_TABS; i++) {
    detailTabs.push(await context.newPage());
  }
  console.log(`  Using ${DETAIL_TABS} parallel tabs for detail pages`);

  /**
   * Blast detail pages for a batch of new auctions in parallel.
   * Returns scraped auctions (with detail data where successful).
   */
  async function blastDetails(newAuctions: ListAuction[]): Promise<ScrapedAuction[]> {
    const results: ScrapedAuction[] = [];
    // Process in chunks of DETAIL_TABS
    for (let i = 0; i < newAuctions.length; i += DETAIL_TABS) {
      if (opts.maxAuctions && scraped >= opts.maxAuctions) break;
      const chunk = newAuctions.slice(i, i + DETAIL_TABS);
      const remaining = opts.maxAuctions ? opts.maxAuctions - scraped : chunk.length;
      const batch = chunk.slice(0, remaining);

      // Launch all detail fetches in parallel with stagger
      const promises = batch.map(async (a, idx) => {
        const tab = detailTabs[idx % detailTabs.length];
        const detailUrl = `${RUBINOT_URLS.base}/?currentcharactertrades/${a.externalId}`;
        await sleep(idx * 500); // 0.5s stagger
        return scrapeAuctionDetail(tab, a, detailUrl, browserName);
      });

      const settled = await Promise.allSettled(promises);
      for (let j = 0; j < settled.length; j++) {
        scraped++;
        const target = opts.maxAuctions ?? '?';
        const a = batch[j];
        if (settled[j].status === 'fulfilled') {
          const auction = (settled[j] as PromiseFulfilledResult<ScrapedAuction>).value;
          console.log(`  [${scraped}/${target}] ${a.characterName} Lv${a.level} (${a.world})`);
          if (opts.onAuction) await opts.onAuction(auction);
          results.push(auction);
        } else {
          // Detail failed — save with list data only
          const auction = mergeListOnly(a);
          console.log(`  [${scraped}/${target}] ${a.characterName} Lv${a.level} (${a.world}) — detail failed`);
          if (opts.onAuction) await opts.onAuction(auction);
          results.push(auction);
        }
      }
    }
    return results;
  }

  // Fetch first page to get total page count
  console.log(`Fetching page 1: ${baseUrl}`);
  try {
    await navigateWithCloudflare(listPage, baseUrl);
    await sleep(1200 + Math.floor(Math.random() * 1800));
  } catch {
    console.error('  Page died on first fetch — recovering browser...');
    await rateLimit('slow');
    listPage = await getHealthyPage(browserName);
    await navigateWithCloudflare(listPage, baseUrl);
    await sleep(1200 + Math.floor(Math.random() * 1800));
  }

  const firstPageHtml = await listPage.content();
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

  if (newOnFirst.length > 0) {
    const batch = await blastDetails(newOnFirst);
    fullAuctions.push(...batch);
  }

  // Track consecutive fully-scraped pages to detect the end of new data
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
      await navigateWithCloudflare(listPage, pageUrl);
      await sleep(800 + Math.floor(Math.random() * 1200));
      const html = await listPage.content();
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
      consecutiveSkippedPages = 0;

      // Blast detail pages in parallel
      const batch = await blastDetails(newOnPage);
      fullAuctions.push(...batch);
    } catch (err) {
      console.error(`  Failed page ${p} — recovering browser...`);
      try {
        listPage = await getHealthyPage(browserName);
      } catch {
        // Will be recovered on next page
      }
    }
  }

  // Clean up detail tabs
  for (const tab of detailTabs) {
    try { await tab.close(); } catch {}
  }

  if (skippedTotal > 0) console.log(`\nSkipped ${skippedTotal} already-scraped auctions total`);
  console.log(`Scraped ${fullAuctions.length} new auctions`);

  return fullAuctions;
}

/**
 * Create a ScrapedAuction from list data only (when detail page fails).
 */
function mergeListOnly(a: ListAuction): ScrapedAuction {
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
    magicLevelPct: null, fistPct: null, clubPct: null, swordPct: null,
    axePct: null, distancePct: null, shieldingPct: null, fishingPct: null,
    outfitImageUrl: null, gems: null, weeklyTaskExpansion: null, battlePassDeluxe: null,
    displayItems: null, outfitNames: null, mountNames: null,
    charmPoints: a.charmPoints,
    unusedCharmPoints: a.unusedCharmPoints,
    bossPoints: a.bossPoints,
    exaltedDust: a.exaltedDust,
    gold: a.gold,
    bestiary: a.bestiary,
    coinsPerLevel,
    url: `${RUBINOT_URLS.base}/?currentcharactertrades/${a.externalId}`,
  };
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
    magicLevelPct: null, fistPct: null, clubPct: null, swordPct: null,
    axePct: null, distancePct: null, shieldingPct: null, fishingPct: null,
    outfitImageUrl: null, gems: null, weeklyTaskExpansion: null, battlePassDeluxe: null,
    displayItems: null, outfitNames: null, mountNames: null,
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
