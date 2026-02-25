/**
 * Transfers scraper for RubinOT.
 * Scrapes the /transfers page via HTML parsing (no JSON API available yet).
 * Requires Brave Browser to bypass Cloudflare.
 */
import { RUBINOT_URLS } from '../utils/constants';
import type { Page } from 'playwright';

export interface ScrapedTransfer {
  playerName: string;
  fromWorld: string;
  toWorld: string;
  level: number | null;
  transferDate: string | null;
}

/**
 * Scrape transfers from the current page.
 * Returns the rows visible on the page (up to 50).
 */
export async function scrapeTransfersPage(page: Page): Promise<ScrapedTransfer[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const transfers: ScrapedTransfer[] = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return;

      // Columns: Fecha, Jugador, Nivel, De, (arrow), A
      const transferDate = cells[0].textContent?.trim() || null;
      const playerName = cells[1].textContent?.trim() || '';
      const levelText = cells[2].textContent?.trim() || '';
      const fromWorld = cells[3].textContent?.trim() || '';
      // cells[4] is the arrow icon
      const toWorld = cells[5]?.textContent?.trim() || '';

      const level = levelText ? parseInt(levelText, 10) : null;

      if (playerName && fromWorld && toWorld) {
        transfers.push({
          playerName,
          fromWorld,
          toWorld,
          level: Number.isNaN(level) ? null : level,
          transferDate,
        });
      }
    });

    return transfers;
  });
}
