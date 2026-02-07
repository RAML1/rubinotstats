/**
 * Highscores scraping and parsing for RubinOT
 */

import { load } from 'cheerio';
import type { HighscoreEntry } from './types';
import { fetchPage } from './browser';
import { cleanText } from './utils';

/**
 * Parse highscores HTML into structured data
 */
export function parseHighscoresPage(
  html: string,
  world: string,
  category: string
): HighscoreEntry[] {
  const $ = load(html);
  const entries: HighscoreEntry[] = [];

  console.log(`Parsing highscores for world: ${world}, category: ${category}`);

  // Find the table with class TableContent that contains highscores
  $('table.TableContent tbody tr').each((index, element) => {
    const $row = $(element);

    // Skip header row (has class LabelH)
    if ($row.hasClass('LabelH')) {
      return;
    }

    const cells = $row.find('td');

    // Highscores table has 6 columns: Rank, Name, Vocation, World, Level, Points
    if (cells.length >= 6) {
      try {
        const rankText = cleanText(cells.eq(0).text());
        const nameText = cleanText(cells.eq(1).text());
        const vocationText = cleanText(cells.eq(2).text());
        const worldText = cleanText(cells.eq(3).text());
        const levelText = cleanText(cells.eq(4).text());
        const valueText = cleanText(cells.eq(5).text());

        // Parse numeric values
        const rank = parseInt(rankText, 10);
        const level = parseInt(levelText, 10);
        const value = parseInt(valueText.replace(/\D/g, ''), 10);

        // Validate data
        if (!isNaN(rank) && nameText && !isNaN(level) && !isNaN(value)) {
          entries.push({
            rank,
            name: nameText,
            vocation: vocationText || 'Unknown',
            level,
            value,
            world: worldText || world,
            category,
          });
        }
      } catch (error) {
        console.warn('Failed to parse highscore row:', error);
      }
    }
  });

  console.log(`Parsed ${entries.length} highscore entries`);
  return entries;
}

/**
 * Scrape highscores for a specific world and category
 */
export async function scrapeHighscores(
  world: string = '',
  category: string = 'experience'
): Promise<HighscoreEntry[]> {
  console.log(`Scraping highscores: world=${world || 'All'}, category=${category}`);

  // Build URL with proper query parameters
  let url = 'https://rubinot.com.br/?subtopic=highscores';

  const params = new URLSearchParams();
  if (world) {
    params.append('world', world);
  }
  params.append('beprotection', '-1');

  // Map category names to their numeric IDs based on the dropdown
  const categoryMap: Record<string, string> = {
    experience: '6',
    magic: 'magic',
    fist: 'fist',
    club: 'club',
    sword: 'sword',
    axe: 'axe',
    distance: 'distance',
    shielding: 'shielding',
    fishing: 'fishing',
  };

  const categoryId = categoryMap[category] || '6';
  params.append('category', categoryId);

  if (params.toString()) {
    url += '&' + params.toString();
  }

  console.log(`Fetching URL: ${url}`);

  // Fetch the page
  const html = await fetchPage(url);

  // Parse and return results
  return parseHighscoresPage(html, world, category);
}

/**
 * Scrape highscores for all worlds
 */
export async function scrapeHighscoresAllWorlds(
  category: string = 'experience'
): Promise<HighscoreEntry[]> {
  const worlds = [
    'Auroria',
    'Belaria',
    'Bellum',
    'Elysian',
    'Lunarian',
    'Mystian',
    'Serenian',
    'Serenian II',
    'Serenian III',
    'Serenian IV',
    'Solarian',
    'Spectrum',
    'Tenebrium',
    'Vesperia',
  ];

  const allEntries: HighscoreEntry[] = [];

  console.log(`Scraping highscores for ${worlds.length} worlds, category: ${category}`);

  for (const world of worlds) {
    try {
      const entries = await scrapeHighscores(world, category);
      allEntries.push(...entries);

      // Rate limiting - wait 2 seconds between worlds
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape highscores for ${world}:`, error);
      // Continue with other worlds
    }
  }

  console.log(`Total entries scraped: ${allEntries.length}`);
  return allEntries;
}

/**
 * Scrape highscores for all categories on a specific world
 */
export async function scrapeHighscoresAllCategories(
  world: string = ''
): Promise<Record<string, HighscoreEntry[]>> {
  const categories = [
    'experience',
    'magic',
    'fist',
    'club',
    'sword',
    'axe',
    'distance',
    'shielding',
    'fishing',
  ];

  const results: Record<string, HighscoreEntry[]> = {};

  console.log(`Scraping all categories for world: ${world || 'All'}`);

  for (const category of categories) {
    try {
      const entries = await scrapeHighscores(world, category);
      results[category] = entries;

      // Rate limiting - wait 2 seconds between categories
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape category ${category}:`, error);
      results[category] = [];
    }
  }

  return results;
}
