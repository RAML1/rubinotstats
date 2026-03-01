/**
 * Deaths scraper for RubinOT.
 * Fetches PvP kills from the /api/deaths JSON endpoint.
 */
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';

export interface RawDeath {
  time: string; // unix timestamp as string
  level: number;
  killed_by: string;
  is_player: number; // 1 = PvP, 0 = PvE
  mostdamage_by: string;
  mostdamage_is_player: number;
  victim: string;
  worldName: string;
}

interface DeathsApiResponse {
  data: RawDeath[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface ScrapedPvpKill {
  killerName: string;
  victimName: string;
  victimLevel: number;
  mostDamageBy: string | null;
  mostDamageIsPlayer: boolean;
  world: string;
  killedAt: Date;
}

/**
 * Fetch a single page of deaths from the API.
 * Uses direct navigation + innerText to avoid page.evaluate serialization issues.
 */
async function fetchDeathsPage(page: Page, pageNum: number): Promise<DeathsApiResponse> {
  const url = `${RUBINOT_URLS.base}${RUBINOT_URLS.api.deaths}?page=${pageNum}`;

  // Use page.evaluate with fetch, then return as stringified JSON to avoid serialization issues
  const text = await page.evaluate(async (apiUrl: string) => {
    const res = await fetch(apiUrl);
    return res.text();
  }, url);

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    console.warn(`  Warning: Page ${pageNum} returned non-JSON response (${text.slice(0, 100)}...)`);
    return { data: [], pagination: { currentPage: pageNum, totalPages: 1, totalItems: 0, itemsPerPage: 50 } };
  }
  // API returns { deaths: [...], pagination: { currentPage, totalPages, totalCount, itemsPerPage } }
  const deathsArray = (raw.deaths || raw.data || []) as RawDeath[];
  const pag = (raw.pagination || {}) as Record<string, unknown>;
  return {
    data: deathsArray,
    pagination: {
      currentPage: (pag.currentPage || pageNum) as number,
      totalPages: (pag.totalPages || 1) as number,
      totalItems: (pag.totalCount || pag.totalItems || deathsArray.length) as number,
      itemsPerPage: (pag.itemsPerPage || 50) as number,
    },
  };
}

/**
 * Fetch all PvP kills from the deaths API (all pages).
 * Filters to only player-vs-player kills (is_player === 1).
 */
export async function fetchAllPvpKills(page: Page): Promise<ScrapedPvpKill[]> {
  const allKills: ScrapedPvpKill[] = [];

  // Fetch first page to get total pages
  const firstPage = await fetchDeathsPage(page, 1);
  const totalPages = firstPage.pagination.totalPages;
  console.log(`  Deaths API: ${firstPage.pagination.totalItems} total deaths across ${totalPages} pages`);

  // Process first page
  const pvpFromFirst = firstPage.data.filter(d => d.is_player === 1);
  for (const d of pvpFromFirst) {
    allKills.push({
      killerName: d.killed_by,
      victimName: d.victim,
      victimLevel: d.level,
      mostDamageBy: d.mostdamage_by && d.mostdamage_by !== d.killed_by ? d.mostdamage_by : null,
      mostDamageIsPlayer: d.mostdamage_is_player === 1,
      world: d.worldName,
      killedAt: new Date(parseInt(d.time) * 1000),
    });
  }
  console.log(`  Page 1: ${pvpFromFirst.length} PvP kills`);

  // Fetch remaining pages
  for (let p = 2; p <= totalPages; p++) {
    const pageData = await fetchDeathsPage(page, p);
    const pvpKills = pageData.data.filter(d => d.is_player === 1);
    for (const d of pvpKills) {
      allKills.push({
        killerName: d.killed_by,
        victimName: d.victim,
        victimLevel: d.level,
        mostDamageBy: d.mostdamage_by && d.mostdamage_by !== d.killed_by ? d.mostdamage_by : null,
        mostDamageIsPlayer: d.mostdamage_is_player === 1,
        world: d.worldName,
        killedAt: new Date(parseInt(d.time) * 1000),
      });
    }
    console.log(`  Page ${p}: ${pvpKills.length} PvP kills`);
  }

  return allKills;
}
