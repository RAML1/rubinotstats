/**
 * Auction scraper and parser
 *
 * Extracts character data from RubinOT auction pages
 * Focuses on skill values and progression metrics
 */

import * as cheerio from 'cheerio';
import { browserScraper, fetchPage } from './browser';
import type { AuctionData } from './types';

const AUCTION_BASE_URL = 'https://rubinot.com.br/?currentcharactertrades';
const AUCTION_DETAIL_URL = 'https://rubinot.com.br/?currentcharactertrades';

/**
 * Parse skill value from various formats
 */
function parseSkillValue(text: string): number {
  // Remove anything after skill level (like "(loyalty bonus)" or percentage)
  const cleaned = text.split('(')[0].trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse number from text, handling various formats
 */
function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse big numbers (like experience) that may have commas/dots
 */
function parseBigNumber(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/**
 * Parse auction HTML page to extract character data
 */
export function parseAuctionPage(html: string, auctionId: string): AuctionData | null {
  const $ = cheerio.load(html);

  try {
    // Character name - usually in the title or header
    const name = $('h1, .character-name, [class*="name"]').first().text().trim() ||
                 $('title').text().split('-')[0].trim();

    if (!name || name.includes('Just a moment')) {
      console.log('Could not find character name or hit Cloudflare');
      return null;
    }

    // Initialize data object
    const data: Partial<AuctionData> = {
      auctionId,
      name,
      scrapedAt: new Date().toISOString(),
      sourceUrl: `${AUCTION_DETAIL_URL}/${auctionId}`,
    };

    // Parse all table rows looking for specific labels
    const labelValuePairs: Record<string, string> = {};

    // Method 1: Look for table rows with label/value pattern
    $('table tr, .row, [class*="info"]').each((_, el) => {
      const cells = $(el).find('td, span, div');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim().toLowerCase();
        const value = $(cells[1]).text().trim();
        if (label && value) {
          labelValuePairs[label] = value;
        }
      }
    });

    // Method 2: Look for labeled spans/divs
    $('[class*="label"], [class*="key"], strong, b').each((_, el) => {
      const label = $(el).text().trim().toLowerCase().replace(':', '');
      const value = $(el).next().text().trim() || $(el).parent().text().replace($(el).text(), '').trim();
      if (label && value) {
        labelValuePairs[label] = value;
      }
    });

    // Extract skills from table with skill names
    const skillMap: Record<string, keyof AuctionData['skills']> = {
      'axe fighting': 'axeFighting',
      'axe': 'axeFighting',
      'club fighting': 'clubFighting',
      'club': 'clubFighting',
      'distance fighting': 'distanceFighting',
      'distance': 'distanceFighting',
      'fishing': 'fishing',
      'fist fighting': 'fistFighting',
      'fist': 'fistFighting',
      'magic level': 'magicLevel',
      'magic': 'magicLevel',
      'ml': 'magicLevel',
      'shielding': 'shielding',
      'shield': 'shielding',
      'sword fighting': 'swordFighting',
      'sword': 'swordFighting',
    };

    // Initialize skills
    data.skills = {
      axeFighting: 0,
      clubFighting: 0,
      distanceFighting: 0,
      fishing: 0,
      fistFighting: 0,
      magicLevel: 0,
      shielding: 0,
      swordFighting: 0,
    };

    // Parse skills from the collected pairs
    for (const [label, value] of Object.entries(labelValuePairs)) {
      const skillKey = skillMap[label];
      if (skillKey) {
        data.skills[skillKey] = parseSkillValue(value);
      }
    }

    // Also look for skills table specifically
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase();
      if (tableText.includes('skill') || tableText.includes('fighting') || tableText.includes('magic level')) {
        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 2) {
            const skillName = $(cells[0]).text().trim().toLowerCase();
            const skillValue = $(cells[1]).text().trim();
            const skillKey = skillMap[skillName];
            if (skillKey) {
              data.skills![skillKey] = parseSkillValue(skillValue);
            }
          }
        });
      }
    });

    // Parse character basics
    for (const [label, value] of Object.entries(labelValuePairs)) {
      switch (label) {
        case 'level':
          data.level = parseNumber(value);
          break;
        case 'vocation':
          data.vocation = value;
          break;
        case 'world':
        case 'server':
          data.world = value;
          break;
        case 'sex':
        case 'gender':
          data.sex = value.toLowerCase().includes('female') ? 'Female' : 'Male';
          break;
        case 'experience':
        case 'exp':
          data.experience = parseBigNumber(value);
          break;
        case 'achievement points':
        case 'achievements':
          data.achievementPoints = parseNumber(value);
          break;
      }
    }

    // Parse auction details
    for (const [label, value] of Object.entries(labelValuePairs)) {
      switch (label) {
        case 'current bid':
        case 'bid':
          data.currentBid = parseNumber(value);
          break;
        case 'winning bid':
        case 'sold for':
          data.winningBid = parseNumber(value);
          break;
        case 'auction start':
        case 'start':
          data.auctionStart = value;
          break;
        case 'auction end':
        case 'end':
        case 'ends':
          data.auctionEnd = value;
          break;
      }
    }

    // Parse cosmetics
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('outfit')) {
        data.outfits = parseNumber(value);
      } else if (label.includes('mount')) {
        data.mounts = parseNumber(value);
      } else if (label.includes('title')) {
        data.titles = parseNumber(value);
      }
    }

    // Parse charm points
    const charmLabels = ['charm point', 'charms', 'available charm', 'spent charm'];
    for (const [label, value] of Object.entries(labelValuePairs)) {
      for (const charmLabel of charmLabels) {
        if (label.includes(charmLabel)) {
          if (!data.charmPoints) {
            data.charmPoints = { total: 0, spent: 0, available: 0 };
          }
          if (label.includes('available')) {
            data.charmPoints.available = parseNumber(value);
          } else if (label.includes('spent')) {
            data.charmPoints.spent = parseNumber(value);
          } else {
            data.charmPoints.total = parseNumber(value);
          }
        }
      }
    }

    // Determine auction status
    const pageText = $.text().toLowerCase();
    if (pageText.includes('finished') || pageText.includes('sold')) {
      data.status = 'finished';
    } else if (pageText.includes('cancelled') || pageText.includes('canceled')) {
      data.status = 'cancelled';
    } else {
      data.status = 'active';
    }

    // Set defaults for missing values
    data.level = data.level || 0;
    data.vocation = data.vocation || 'Unknown';
    data.world = data.world || 'Unknown';
    data.sex = data.sex || 'Male';
    data.experience = data.experience || '0';
    data.achievementPoints = data.achievementPoints || 0;
    data.gold = data.gold || 0;
    data.hitPoints = data.hitPoints || 0;
    data.mana = data.mana || 0;
    data.capacity = data.capacity || 0;
    data.speed = data.speed || 0;
    data.outfits = data.outfits || 0;
    data.mounts = data.mounts || 0;
    data.titles = data.titles || 0;
    data.blessings = data.blessings || 0;
    data.currentBid = data.currentBid || 0;
    data.auctionStart = data.auctionStart || '';
    data.auctionEnd = data.auctionEnd || '';

    return data as AuctionData;
  } catch (error) {
    console.error('Error parsing auction page:', error);
    return null;
  }
}

/**
 * Parse auction for database storage
 * Returns flat object matching Prisma Auction model
 */
export interface AuctionDbData {
  externalId: string;
  characterName: string;
  vocation: string | null;
  level: number | null;
  world: string | null;

  // Skills
  magicLevel: number | null;
  fist: number | null;
  club: number | null;
  sword: number | null;
  axe: number | null;
  distance: number | null;
  shielding: number | null;
  fishing: number | null;

  // Charm system
  availableCharmPoints: number | null;
  spentCharmPoints: number | null;
  charms: object | null;

  // Account features
  preySlots: number | null;
  preyWildcards: number | null;
  huntingSlots: number | null;
  imbuementSlots: number | null;

  // Cosmetics
  outfitsCount: number | null;
  mountsCount: number | null;

  // Hirelings
  hirelings: number | null;
  hirelingJobs: number | null;
  hirelingOutfits: number | null;

  // Progression
  dailyRewardStreak: number | null;
  exaltedDust: number | null;
  exaltedDustLimit: number | null;
  bossPoints: number | null;

  // Quest progress
  completedQuestLines: string[] | null;

  // Auction details
  startingBid: number | null;
  currentBid: number | null;
  buyoutPrice: number | null;
  status: string;
  soldPrice: number | null;
  listedAt: Date | null;
  endsAt: Date | null;
  soldAt: Date | null;
}

/**
 * Parse auction HTML and return database-ready object
 */
export function parseAuctionForDb(html: string, auctionId: string): AuctionDbData | null {
  const $ = cheerio.load(html);

  try {
    // Build label-value map from all possible sources
    const labelValuePairs: Record<string, string> = {};

    // Parse tables
    $('table tr').each((_, row) => {
      const cells = $(row).find('td, th');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().trim().toLowerCase().replace(':', '');
        const value = $(cells[1]).text().trim();
        if (label && value) {
          labelValuePairs[label] = value;
        }
      }
    });

    // Parse divs with labels
    $('div, span').each((_, el) => {
      const text = $(el).text().trim();
      if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length === 2) {
          const label = parts[0].trim().toLowerCase();
          const value = parts[1].trim();
          if (label && value && !labelValuePairs[label]) {
            labelValuePairs[label] = value;
          }
        }
      }
    });

    // Character name
    const characterName = $('h1, .character-name, [class*="name"]').first().text().trim() ||
                          labelValuePairs['name'] ||
                          labelValuePairs['character'] ||
                          'Unknown';

    if (characterName.includes('Just a moment')) {
      console.log('Hit Cloudflare challenge page');
      return null;
    }

    // Initialize result
    const result: AuctionDbData = {
      externalId: auctionId,
      characterName,
      vocation: null,
      level: null,
      world: null,
      magicLevel: null,
      fist: null,
      club: null,
      sword: null,
      axe: null,
      distance: null,
      shielding: null,
      fishing: null,
      availableCharmPoints: null,
      spentCharmPoints: null,
      charms: null,
      preySlots: null,
      preyWildcards: null,
      huntingSlots: null,
      imbuementSlots: null,
      outfitsCount: null,
      mountsCount: null,
      hirelings: null,
      hirelingJobs: null,
      hirelingOutfits: null,
      dailyRewardStreak: null,
      exaltedDust: null,
      exaltedDustLimit: null,
      bossPoints: null,
      completedQuestLines: null,
      startingBid: null,
      currentBid: null,
      buyoutPrice: null,
      status: 'active',
      soldPrice: null,
      listedAt: null,
      endsAt: null,
      soldAt: null,
    };

    // Parse character basics
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label === 'level' || label === 'nível') {
        result.level = parseNumber(value);
      } else if (label === 'vocation' || label === 'vocação') {
        result.vocation = value;
      } else if (label === 'world' || label === 'server' || label === 'mundo') {
        result.world = value;
      }
    }

    // Parse skills
    const skillMapping: Record<string, keyof Pick<AuctionDbData, 'magicLevel' | 'fist' | 'club' | 'sword' | 'axe' | 'distance' | 'shielding' | 'fishing'>> = {
      'magic level': 'magicLevel',
      'magic': 'magicLevel',
      'ml': 'magicLevel',
      'fist fighting': 'fist',
      'fist': 'fist',
      'club fighting': 'club',
      'club': 'club',
      'sword fighting': 'sword',
      'sword': 'sword',
      'axe fighting': 'axe',
      'axe': 'axe',
      'distance fighting': 'distance',
      'distance': 'distance',
      'shielding': 'shielding',
      'shield': 'shielding',
      'fishing': 'fishing',
    };

    for (const [label, value] of Object.entries(labelValuePairs)) {
      const skillKey = skillMapping[label];
      if (skillKey) {
        result[skillKey] = parseSkillValue(value);
      }
    }

    // Parse charm points
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('available charm') || label.includes('charm points available')) {
        result.availableCharmPoints = parseNumber(value);
      } else if (label.includes('spent charm') || label.includes('charm points spent')) {
        result.spentCharmPoints = parseNumber(value);
      }
    }

    // Parse account features
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('prey slot')) {
        result.preySlots = parseNumber(value);
      } else if (label.includes('prey wildcard')) {
        result.preyWildcards = parseNumber(value);
      } else if (label.includes('hunting slot') || label.includes('hunting task slot')) {
        result.huntingSlots = parseNumber(value);
      } else if (label.includes('imbuement slot')) {
        result.imbuementSlots = parseNumber(value);
      }
    }

    // Parse cosmetics
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('outfit')) {
        result.outfitsCount = parseNumber(value);
      } else if (label.includes('mount')) {
        result.mountsCount = parseNumber(value);
      }
    }

    // Parse hirelings
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label === 'hirelings' || label === 'hireling') {
        result.hirelings = parseNumber(value);
      } else if (label.includes('hireling job')) {
        result.hirelingJobs = parseNumber(value);
      } else if (label.includes('hireling outfit')) {
        result.hirelingOutfits = parseNumber(value);
      }
    }

    // Parse progression
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('daily reward') || label.includes('reward streak')) {
        result.dailyRewardStreak = parseNumber(value);
      } else if (label.includes('exalted dust') && !label.includes('limit')) {
        result.exaltedDust = parseNumber(value);
      } else if (label.includes('exalted dust limit') || label.includes('dust limit')) {
        result.exaltedDustLimit = parseNumber(value);
      } else if (label.includes('boss point')) {
        result.bossPoints = parseNumber(value);
      }
    }

    // Parse quest lines - look for a list
    const questLines: string[] = [];
    $('[class*="quest"], [class*="Quest"]').each((_, el) => {
      const questName = $(el).text().trim();
      if (questName && !questName.includes('Quest') && questName.length < 100) {
        questLines.push(questName);
      }
    });
    if (questLines.length > 0) {
      result.completedQuestLines = questLines;
    }

    // Parse auction details
    for (const [label, value] of Object.entries(labelValuePairs)) {
      if (label.includes('starting bid') || label.includes('minimum bid')) {
        result.startingBid = parseNumber(value);
      } else if (label.includes('current bid') || label === 'bid') {
        result.currentBid = parseNumber(value);
      } else if (label.includes('buyout') || label.includes('buy now')) {
        result.buyoutPrice = parseNumber(value);
      } else if (label.includes('sold') && label.includes('price')) {
        result.soldPrice = parseNumber(value);
      }
    }

    // Determine status
    const pageText = $.text().toLowerCase();
    if (pageText.includes('sold') || pageText.includes('vendido')) {
      result.status = 'sold';
    } else if (pageText.includes('finished') || pageText.includes('finalizado')) {
      result.status = 'finished';
    } else if (pageText.includes('cancelled') || pageText.includes('canceled') || pageText.includes('cancelado')) {
      result.status = 'cancelled';
    }

    return result;
  } catch (error) {
    console.error('Error parsing auction for DB:', error);
    return null;
  }
}

/**
 * Scrape a single auction by ID
 */
export async function scrapeAuction(auctionId: string): Promise<AuctionDbData | null> {
  const url = `${AUCTION_DETAIL_URL}/${auctionId}`;

  try {
    const html = await fetchPage(url);
    return parseAuctionForDb(html, auctionId);
  } catch (error) {
    console.error(`Error scraping auction ${auctionId}:`, error);
    return null;
  }
}

/**
 * Scrape multiple auctions
 */
export async function scrapeAuctions(auctionIds: string[]): Promise<AuctionDbData[]> {
  const results: AuctionDbData[] = [];

  for (const id of auctionIds) {
    console.log(`Scraping auction ${id}...`);
    const data = await scrapeAuction(id);
    if (data) {
      results.push(data);
      console.log(`  ✓ ${data.characterName} - Level ${data.level} ${data.vocation}`);
    } else {
      console.log(`  ✗ Failed to parse auction ${id}`);
    }
  }

  return results;
}

/**
 * Extract auction IDs from the auction list page
 */
export function parseAuctionList(html: string): string[] {
  const $ = cheerio.load(html);
  const ids: string[] = [];

  // Look for links to individual auctions
  $('a[href*="currentcharactertrades/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const match = href.match(/currentcharactertrades\/(\d+)/);
      if (match) {
        ids.push(match[1]);
      }
    }
  });

  // Also look for data attributes
  $('[data-auction-id], [data-id]').each((_, el) => {
    const id = $(el).attr('data-auction-id') || $(el).attr('data-id');
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  });

  return [...new Set(ids)]; // Remove duplicates
}

/**
 * Scrape auction list page to get all current auction IDs
 */
export async function scrapeAuctionList(): Promise<string[]> {
  try {
    const html = await fetchPage(AUCTION_BASE_URL);
    return parseAuctionList(html);
  } catch (error) {
    console.error('Error scraping auction list:', error);
    return [];
  }
}

/**
 * Scrape all current auctions
 */
export async function scrapeAllCurrentAuctions(): Promise<AuctionDbData[]> {
  console.log('Fetching auction list...');
  const ids = await scrapeAuctionList();
  console.log(`Found ${ids.length} auctions`);

  if (ids.length === 0) {
    return [];
  }

  return scrapeAuctions(ids);
}
