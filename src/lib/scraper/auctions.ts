/**
 * Auction scraper for RubinOT character bazaar.
 * Uses the JSON API at /api/bazaar and /api/bazaar/{id}.
 * Still needs Brave Browser to bypass Cloudflare on initial navigation.
 */
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';
import { navigateWithCloudflare, rateLimit, sleep, type BrowserName } from './browser';

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
  // Weapon proficiency (JSON string)
  weaponProficiency: string | null;
  // Calculated
  coinsPerLevel: number | null;
  url: string;
}

// ── API response types ──────────────────────────────────────────────────

interface ApiBazaarListAuction {
  id: number;
  state: number;
  stateName: string;
  playerId: number;
  owner: string;
  startingValue: number;
  currentValue: number;
  auctionStart: number | string;
  auctionEnd: number | string;
  name: string;
  level: number;
  vocation: number;
  vocationName: string;
  sex: number;
  worldId: number;
  worldName: string;
  lookType: number;
  lookHead: number;
  lookBody: number;
  lookLegs: number;
  lookFeet: number;
  lookAddons: number;
  direction: number;
  charmPoints: number;
  achievementPoints: number;
  magLevel: number;
  skills: {
    club: number;
    sword: number;
    axe: number;
    dist: number;
    shielding: number;
  };
  highlightItems: { itemId: number; clientId: number; tier: number; count: number; name: string }[];
  highlightAugments: { text: string; argType: string }[];
  myBid: number | null;
  isWinning: boolean;
  isWatching: boolean;
}

interface ApiBazaarListResponse {
  auctions: ApiBazaarListAuction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiWeaponProficiency {
  itemId: number;
  experience: number;
  weaponLevel: number;
  masteryAchieved: boolean;
  activePerks: { lane: number; index: number }[];
}

interface ApiBazaarDetailResponse {
  auction: {
    id: number;
    state: number;
    stateName: string;
    startingValue: number;
    currentValue: number;
    auctionStart: number | string;
    auctionEnd: number | string;
  };
  player: {
    id: number;
    name: string;
    level: number;
    vocation: number;
    vocationName: string;
    sex: number;
    worldId: number;
    worldName: string;
    lookType: number;
  };
  general: {
    health: number;
    healthMax: number;
    mana: number;
    manaMax: number;
    manaSpent: string;
    cap: number;
    stamina: number;
    soul: number;
    experience: number | string;
    magLevel: number;
    skills: {
      fist: number;
      fistTries: number;
      club: number;
      clubTries: number;
      sword: number;
      swordTries: number;
      axe: number;
      axeTries: number;
      dist: number;
      distTries: number;
      shielding: number;
      shieldingTries: number;
      fishing: number;
      fishingTries: number;
    };
    mountsCount: number;
    outfitsCount: number;
    titlesCount: number;
    linkedTasks: number;
    createDate: number;
    balance: string;
    totalMoney: string;
    achievementPoints: number;
    charmPoints: number;
    spentCharmPoints: number;
    availableCharmPoints: number;
    spentMinorEchoes: number;
    availableMinorEchoes: number;
    charmExpansion: boolean;
    streakDays: number;
    huntingTaskPoints: number;
    thirdPrey: boolean;
    thirdHunting: boolean;
    preyWildcards: number;
    hirelingCount: number;
    hirelingJobs: number;
    hirelingOutfits: number;
    dust: number;
    dustMax: number;
    bossPoints: number;
    wheelPoints: number;
    maxWheelPoints: number;
    gpActive: boolean;
    gpPoints: number;
  };
  items: { itemId: number; clientId: number; tier: number; count: number; name: string }[];
  itemsTotal: number;
  storeItems: { itemId: number; clientId: number; tier: number; count: number; name: string }[];
  storeItemsTotal: number;
  outfits: { name: string; lookType: number; addons: number }[];
  mounts: { name: string; lookType: number }[];
  familiars: { name: string; lookType: number }[];
  charms: { name: string; cost: number }[];
  blessings: { name: string; count: number }[];
  titles: { name: string }[];
  gems: { id: number; domain: number; type: number; lesserBonusId: number; regularBonusId: number; supremeBonusId: number }[];
  bosstiaries: { name: string; kills: number }[];
  bosstiariosTotal: number;
  weaponProficiency: ApiWeaponProficiency[];
  achievements: { name: string; grade: number }[];
  highlightItems: { itemId: number; clientId: number; tier: number; count: number; name: string }[];
  highlightAugments: { text: string; argType: number }[];
  bountyTalismans: unknown[];
  bountyPoints: number;
  totalBountyPoints: number;
  bountyRerolls: number;
  auras: unknown[];
  battlepassSeasons: { season: number; points: number; active: number }[];
}

// ── Vocation name map ──────────────────────────────────────────────────

const VOCATION_NAMES: Record<number, string> = {
  0: 'None',
  1: 'Knight',
  2: 'Elite Knight',
  3: 'Paladin',
  4: 'Royal Paladin',
  5: 'Sorcerer',
  6: 'Master Sorcerer',
  7: 'Druid',
  8: 'Elder Druid',
  9: 'Monk',
};

// ── Gender name map ────────────────────────────────────────────────────

function genderFromSex(sex: number): string {
  return sex === 0 ? 'Female' : 'Male';
}

// ── Quest detection from achievements ──────────────────────────────────

const TRACKED_QUESTS = {
  primalOrdealAvailable: ['primal ordeal'],
  soulWarAvailable: ['soul war'],
  sanguineBloodAvailable: ['sanguine', 'rotten blood'],
} as const;

function detectQuestAvailability(achievements: { name: string }[] | null | undefined): {
  primalOrdealAvailable: boolean | null;
  soulWarAvailable: boolean | null;
  sanguineBloodAvailable: boolean | null;
} {
  if (!achievements || achievements.length === 0) {
    return { primalOrdealAvailable: null, soulWarAvailable: null, sanguineBloodAvailable: null };
  }

  const names = achievements
    .filter(a => a && a.name)
    .map(a => a.name.toLowerCase());
  const result: Record<string, boolean | null> = {};

  for (const [field, patterns] of Object.entries(TRACKED_QUESTS)) {
    const completed = names.some(n => patterns.some(p => n.includes(p)));
    result[field] = !completed; // available = NOT completed
  }

  return result as any;
}

// ── Skill percentage calculation from tries ────────────────────────────

/**
 * RubinOT uses tries to track skill progress. The API gives us raw tries values.
 * We can approximate percentage from tries, but without knowing the exact formula
 * the server uses, we store null for now (the old scraper got this from the HTML).
 * TODO: if we discover the tries→percentage formula, compute it here.
 */
function skillPctFromTries(_tries: number): number | null {
  return null;
}

// ── Timestamp → date string ─────────────────────────────────────────────

function timestampToDateString(ts: number | string | null | undefined): string | null {
  if (ts == null) return null;
  if (typeof ts === 'string') return ts;
  // Unix timestamp (seconds)
  const date = new Date(ts * 1000);
  return date.toISOString().replace('T', ' ').replace('.000Z', ' CET');
}

// ── Outfit image URL builder ───────────────────────────────────────────
// Uses the public outfit-images.ots.me service to generate static outfit PNGs
// from the lookType + color/addon parameters provided by the RubinOT API.

function buildOutfitImageUrl(player: { lookType: number; lookHead?: number; lookBody?: number; lookLegs?: number; lookFeet?: number; lookAddons?: number; direction?: number }): string | null {
  if (!player.lookType) return null;
  const params = new URLSearchParams({
    id: String(player.lookType),
    addons: String(player.lookAddons ?? 0),
    head: String(player.lookHead ?? 0),
    body: String(player.lookBody ?? 0),
    legs: String(player.lookLegs ?? 0),
    feet: String(player.lookFeet ?? 0),
    direction: '3',
  });
  return `https://outfit-images.ots.me/latest/animoutfit.php?${params.toString()}`;
}

// ── API fetchers (run inside browser page context) ─────────────────────

export async function fetchBazaarListPage(
  page: Page,
  pageNum: number,
  limit = 25,
  sortBy = 'auction_end',
  sortOrder = 'asc',
): Promise<ApiBazaarListResponse> {
  const url = `/api/bazaar?page=${pageNum}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
  return page.evaluate(async (apiUrl: string) => {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Bazaar API ${res.status}: ${res.statusText}`);
    return res.json();
  }, url);
}

export async function fetchBazaarDetail(
  page: Page,
  auctionId: number | string,
): Promise<ApiBazaarDetailResponse> {
  const url = `/api/bazaar/${auctionId}`;
  return page.evaluate(async (apiUrl: string) => {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`Bazaar Detail API ${res.status}: ${res.statusText}`);
    return res.json();
  }, url);
}

// ── Convert API list auction to our CurrentListAuction format ──────────

export interface CurrentListAuction {
  externalId: string;
  characterName: string;
  level: number | null;
  vocation: string | null;
  gender: string | null;
  world: string | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  minimumBid: number | null;
  currentBid: number | null;
  hasBeenBidOn: boolean;
  charmPoints: number | null;
  unusedCharmPoints: number | null;
  bossPoints: number | null;
  exaltedDust: string | null;
  gold: number | null;
  bestiary: number | null;
  // Additional fields from API
  magLevel: number | null;
  achievementPoints: number | null;
  highlightItems: { itemId: number; clientId: number; tier: number; count: number; name: string }[];
  outfitImageUrl: string | null;
}

export function apiAuctionToListAuction(a: ApiBazaarListAuction): CurrentListAuction {
  return {
    externalId: a.id.toString(),
    characterName: a.name,
    level: a.level,
    vocation: a.vocationName || VOCATION_NAMES[a.vocation] || null,
    gender: genderFromSex(a.sex),
    world: a.worldName,
    auctionStart: timestampToDateString(a.auctionStart),
    auctionEnd: timestampToDateString(a.auctionEnd),
    minimumBid: a.startingValue,
    currentBid: a.currentValue > a.startingValue ? a.currentValue : null,
    hasBeenBidOn: a.currentValue > a.startingValue,
    charmPoints: a.charmPoints ?? null,
    unusedCharmPoints: null, // not in list API
    bossPoints: null, // not in list API
    exaltedDust: null, // not in list API
    gold: null, // not in list API
    bestiary: null, // not in list API
    magLevel: a.magLevel ?? null,
    achievementPoints: a.achievementPoints ?? null,
    highlightItems: a.highlightItems ?? [],
    outfitImageUrl: buildOutfitImageUrl(a),
  };
}

// ── Convert API detail response to full ScrapedAuction ────────────────

export function apiDetailToScrapedAuction(
  detail: ApiBazaarDetailResponse,
  listAuction?: CurrentListAuction,
): ScrapedAuction {
  const auction = detail.auction ?? {} as any;
  const player = detail.player ?? {} as any;
  const general = detail.general ?? {} as any;
  const sk = general.skills ?? {} as any;

  const level = player.level ?? null;
  const currentBid = auction.currentValue ?? 0;
  const startingValue = auction.startingValue ?? 0;
  const hasBeenBidOn = currentBid > startingValue;
  const soldPrice = hasBeenBidOn ? currentBid : null;

  // Build display items from highlight items
  const displayItems = detail.highlightItems?.length > 0
    ? JSON.stringify(detail.highlightItems.map(item => ({
        url: `https://static.rubinot.com/objects/${item.clientId}.gif`,
        name: item.name,
        tier: item.tier,
      })))
    : null;

  // Build outfit/mount name lists (filter out null/undefined names)
  const outfitNamesList = detail.outfits?.map(o => o.name).filter(Boolean) ?? [];
  const outfitNames = outfitNamesList.length > 0
    ? JSON.stringify(outfitNamesList)
    : null;
  const mountNamesList = detail.mounts?.map(m => m.name).filter(Boolean) ?? [];
  const mountNames = mountNamesList.length > 0
    ? JSON.stringify(mountNamesList)
    : null;

  // Build gems
  const gems = detail.gems?.length > 0
    ? JSON.stringify(detail.gems)
    : null;

  // Build weapon proficiency (store itemId, experience, weaponLevel, masteryAchieved)
  const weaponProficiency = detail.weaponProficiency?.length > 0
    ? JSON.stringify(detail.weaponProficiency.map(wp => ({
        itemId: wp.itemId,
        experience: wp.experience,
        weaponLevel: wp.weaponLevel,
        masteryAchieved: wp.masteryAchieved,
        perks: wp.activePerks?.length ?? 0,
      })))
    : null;

  // Quest availability from achievements
  const quests = detectQuestAvailability(detail.achievements ?? []);

  // Check for loot pouch in store items
  const hasLootPouch = detail.storeItems?.some(
    item => item.name?.toLowerCase().includes('loot pouch')
  ) ?? null;

  const coinsPerLevel = soldPrice && level && level > 0
    ? Math.round((soldPrice / level) * 100) / 100
    : null;

  return {
    externalId: (auction.id ?? '').toString(),
    characterName: player.name ?? '',
    level,
    vocation: player.vocationName || VOCATION_NAMES[player.vocation] || null,
    gender: player.sex != null ? genderFromSex(player.sex) : null,
    world: player.worldName ?? null,
    auctionStart: timestampToDateString(auction.auctionStart),
    auctionEnd: timestampToDateString(auction.auctionEnd),
    auctionStatus: auction.stateName?.toLowerCase() ?? null,
    soldPrice,
    magicLevel: general.magLevel ?? null,
    fist: sk.fist ?? null,
    club: sk.club ?? null,
    sword: sk.sword ?? null,
    axe: sk.axe ?? null,
    distance: sk.dist ?? null,
    shielding: sk.shielding ?? null,
    fishing: sk.fishing ?? null,
    hitPoints: general.health ?? general.healthMax ?? null,
    mana: general.mana ?? general.manaMax ?? null,
    capacity: general.cap ?? null,
    speed: null, // no longer in API
    experience: general.experience?.toString() ?? null,
    creationDate: general.createDate ? timestampToDateString(general.createDate) : null,
    achievementPoints: general.achievementPoints ?? null,
    mountsCount: general.mountsCount ?? detail.mounts?.length ?? null,
    outfitsCount: general.outfitsCount ?? detail.outfits?.length ?? null,
    titlesCount: general.titlesCount ?? detail.titles?.length ?? null,
    linkedTasks: general.linkedTasks ?? null,
    charmExpansion: general.charmExpansion ?? null,
    charmPoints: general.charmPoints ?? null,
    unusedCharmPoints: general.availableCharmPoints ?? null,
    spentCharmPoints: general.spentCharmPoints ?? null,
    preySlots: general.thirdPrey ? 3 : 2,
    preyWildcards: general.preyWildcards ?? null,
    huntingTaskPoints: general.huntingTaskPoints ?? null,
    hirelings: general.hirelingCount ?? null,
    hirelingJobs: general.hirelingJobs ?? null,
    hasLootPouch,
    storeItemsCount: detail.storeItemsTotal ?? detail.storeItems?.length ?? null,
    bossPoints: general.bossPoints ?? null,
    blessingsCount: detail.blessings?.length ?? null,
    exaltedDust: general.dust != null && general.dustMax != null ? `${general.dust}/${general.dustMax}` : null,
    gold: general.totalMoney ? parseInt(general.totalMoney, 10) || 0 : null,
    bestiary: detail.bosstiariosTotal ?? null,
    dailyRewardStreak: general.streakDays ?? null,
    ...quests,
    magicLevelPct: null, // TODO: compute from magLevel tries if API provides
    fistPct: skillPctFromTries(sk.fistTries),
    clubPct: skillPctFromTries(sk.clubTries),
    swordPct: skillPctFromTries(sk.swordTries),
    axePct: skillPctFromTries(sk.axeTries),
    distancePct: skillPctFromTries(sk.distTries),
    shieldingPct: skillPctFromTries(sk.shieldingTries),
    fishingPct: skillPctFromTries(sk.fishingTries),
    outfitImageUrl: listAuction?.outfitImageUrl ?? buildOutfitImageUrl(player as any),
    gems,
    weeklyTaskExpansion: general.thirdHunting ?? null,
    battlePassDeluxe: general.gpActive ?? null,
    displayItems,
    outfitNames,
    mountNames,
    weaponProficiency,
    coinsPerLevel,
    url: `${RUBINOT_URLS.base}/bazaar/${auction.id}`,
  };
}

// ── Pagination helper ──────────────────────────────────────────────────

export function getTotalPages(apiResponse: ApiBazaarListResponse): number {
  return apiResponse.pagination.totalPages;
}

// ── Full auction history scraper ───────────────────────────────────────

export interface ScrapeOptions {
  maxPages?: number;
  maxAuctions?: number;
  skipExternalIds?: Set<string>;
  onAuction?: (auction: ScrapedAuction) => Promise<void>;
  browserName?: BrowserName;
}

/**
 * Scrape auction history via the JSON API.
 * Fetches list pages, then detail pages for new auctions.
 */
export async function scrapeAuctionHistory(
  page: Page,
  opts: ScrapeOptions = {},
): Promise<ScrapedAuction[]> {
  const fullAuctions: ScrapedAuction[] = [];
  let scraped = 0;
  let skippedTotal = 0;

  // Fetch first page to get pagination
  console.log('Fetching bazaar page 1 via API...');
  const firstPage = await fetchBazaarListPage(page, 1);
  const totalPages = opts.maxPages
    ? Math.min(firstPage.pagination.totalPages, opts.maxPages)
    : firstPage.pagination.totalPages;

  console.log(`Page 1: ${firstPage.auctions.length} auctions, ${totalPages} total pages, ${firstPage.pagination.total} total auctions`);

  // Collect all list auctions across pages
  const allListAuctions: CurrentListAuction[] = firstPage.auctions.map(apiAuctionToListAuction);

  for (let p = 2; p <= totalPages; p++) {
    if (opts.maxAuctions && scraped >= opts.maxAuctions) break;

    await rateLimit('fast');
    try {
      console.log(`Fetching bazaar page ${p}/${totalPages}...`);
      const pageData = await fetchBazaarListPage(page, p);
      const pageAuctions = pageData.auctions.map(apiAuctionToListAuction);
      console.log(`  Page ${p}: ${pageAuctions.length} auctions`);
      allListAuctions.push(...pageAuctions);
    } catch (err) {
      console.error(`  Failed page ${p}: ${(err as Error).message?.substring(0, 80)}`);
    }
  }

  console.log(`\nTotal auctions found: ${allListAuctions.length}`);

  // Filter to new auctions that need detail scraping
  const needDetail = opts.skipExternalIds
    ? allListAuctions.filter(a => !opts.skipExternalIds!.has(a.externalId))
    : allListAuctions;
  skippedTotal = allListAuctions.length - needDetail.length;

  if (skippedTotal > 0) {
    console.log(`Skipping ${skippedTotal} already-scraped auctions`);
  }

  // Scrape detail pages
  for (const listAuction of needDetail) {
    if (opts.maxAuctions && scraped >= opts.maxAuctions) break;
    scraped++;

    try {
      await rateLimit('fast');
      const target = opts.maxAuctions ?? needDetail.length;
      console.log(`  [${scraped}/${target}] ${listAuction.characterName} Lv${listAuction.level} (${listAuction.world})`);

      const detail = await fetchBazaarDetail(page, listAuction.externalId);
      const auction = apiDetailToScrapedAuction(detail, listAuction);

      if (opts.onAuction) await opts.onAuction(auction);
      fullAuctions.push(auction);
    } catch (err) {
      console.error(`    Failed detail for ${listAuction.characterName}: ${(err as Error).message?.substring(0, 60)}`);
    }
  }

  console.log(`\nScraped ${fullAuctions.length} auctions with detail`);
  return fullAuctions;
}

/**
 * Scrape a single auction by ID using the detail API.
 */
export async function scrapeSingleAuction(
  page: Page,
  auctionId: string,
): Promise<ScrapedAuction | null> {
  console.log(`Fetching auction ${auctionId} via API...`);
  try {
    const detail = await fetchBazaarDetail(page, auctionId);
    return apiDetailToScrapedAuction(detail);
  } catch (err) {
    console.error(`Failed to fetch auction ${auctionId}: ${(err as Error).message}`);
    return null;
  }
}
