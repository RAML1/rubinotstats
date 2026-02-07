/**
 * Character scraping and parsing for RubinOT
 */

import { load } from 'cheerio';
import type { CharacterData } from './types';
import { fetchPage } from './browser';
import { cleanText } from './utils';

/**
 * Parse character page HTML into structured data
 */
export function parseCharacterPage(html: string): CharacterData | null {
  const $ = load(html);

  console.log('Parsing character page...');

  try {
    // Character data is in a table with rows like "Name: Value"
    const characterInfo: Partial<CharacterData> = {
      magicLevel: 0,
      fist: 0,
      club: 0,
      sword: 0,
      axe: 0,
      distance: 0,
      shielding: 0,
      fishing: 0,
    };

    // Find all table rows in the character information section
    $('table tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const label = cleanText(cells.eq(0).text()).replace(':', '');
        const value = cleanText(cells.eq(1).text());

        switch (label) {
          case 'Name':
            characterInfo.name = value;
            break;

          case 'Vocation':
            characterInfo.vocation = value;
            break;

          case 'Level':
            characterInfo.level = parseInt(value, 10);
            break;

          case 'World':
            characterInfo.world = value;
            break;

          case 'Guild':
            // Guild name might have a link, extract text only
            const guildText = cells.eq(1).text().trim();
            // Remove "Academy of the" prefix if present
            characterInfo.guildName = guildText.replace(/^Academy of the\s+/, '');
            break;

          case 'Account status':
          case 'Account Status':
            characterInfo.accountStatus = value;
            break;

          case 'Last login':
          case 'Last Login':
            characterInfo.lastLogin = value;
            break;
        }
      }
    });

    // Validate required fields
    if (!characterInfo.name || !characterInfo.level || !characterInfo.vocation || !characterInfo.world) {
      console.warn('Missing required character fields');
      return null;
    }

    // Set default experience as string based on level (approximation)
    // In reality, we'd need to scrape the skills table which might not be on this page
    characterInfo.experience = '0';

    console.log(`Parsed character: ${characterInfo.name}`);

    return characterInfo as CharacterData;
  } catch (error) {
    console.error('Failed to parse character page:', error);
    return null;
  }
}

/**
 * Scrape a character by name
 */
export async function scrapeCharacter(name: string): Promise<CharacterData | null> {
  console.log(`Scraping character: ${name}`);

  // Build URL
  const url = `https://rubinot.com.br/?subtopic=characters&name=${encodeURIComponent(name)}`;

  console.log(`Fetching URL: ${url}`);

  try {
    // Fetch the page
    const html = await fetchPage(url);

    // Parse and return results
    return parseCharacterPage(html);
  } catch (error) {
    console.error(`Failed to scrape character ${name}:`, error);
    return null;
  }
}

/**
 * Scrape multiple characters by name
 */
export async function scrapeCharacters(names: string[]): Promise<(CharacterData | null)[]> {
  console.log(`Scraping ${names.length} characters`);

  const results: (CharacterData | null)[] = [];

  for (const name of names) {
    try {
      const character = await scrapeCharacter(name);
      results.push(character);

      // Rate limiting - wait 2 seconds between characters
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape character ${name}:`, error);
      results.push(null);
    }
  }

  const successCount = results.filter((r) => r !== null).length;
  console.log(`Successfully scraped ${successCount}/${names.length} characters`);

  return results;
}

/**
 * Extract character names from highscores entries
 */
export function extractCharacterNames(entries: { name: string }[]): string[] {
  return Array.from(new Set(entries.map((entry) => entry.name)));
}
