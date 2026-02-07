/**
 * Daily Highscores Scraper Job
 *
 * Runs once per day (recommend 4 AM BRT via cron)
 * Scrapes all worlds and categories, saves to database
 *
 * Total: 99 page fetches (11 worlds × 9 categories) with 2-second delays = ~3.5 minutes minimum
 */

import { scrapeHighscores, browserScraper } from '@/lib/scraper';
import {
  upsertCharacter,
  createSnapshot,
  createSkillSnapshot,
  hasScrapedToday,
  getTotalCharactersTracked,
  getSnapshotsCreatedToday,
} from '../db-sync';
import { WORLDS, HIGHSCORE_CATEGORIES } from '@/lib/utils/constants';
import type { HighscoreCategory, World, Vocation } from '@/lib/utils/constants';
import type { HighscoreEntry } from '@/types';

const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests (polite scraping)

interface ScraperJobResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  worldsProcessed: number;
  categoriesProcessed: number;
  charactersUpserted: number;
  snapshotsCreated: number;
  errors: string[];
  summary: string;
}

/**
 * Delay helper function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// parseHighscoresHtml function removed - now using scrapeHighscores from @/lib/scraper

/**
 * Process highscore entries and save to database
 */
async function processHighscoreEntries(
  entries: HighscoreEntry[],
  category: HighscoreCategory,
  date: Date
): Promise<{ upserted: number; snapshots: number }> {
  let upserted = 0;
  let snapshots = 0;

  for (const entry of entries) {
    try {
      // Upsert character
      const character = await upsertCharacter(entry);
      upserted++;

      // Create appropriate snapshot based on category
      if (category === 'experience') {
        await createSnapshot(character.id, entry, date);
      } else {
        // For skill categories, create skill-specific snapshots
        const skillMap: Record<string, 'magicLevel' | 'fist' | 'club' | 'sword' | 'axe' | 'distance' | 'shielding' | 'fishing'> = {
          'magic': 'magicLevel',
          'fist': 'fist',
          'club': 'club',
          'sword': 'sword',
          'axe': 'axe',
          'distance': 'distance',
          'shielding': 'shielding',
          'fishing': 'fishing',
        };

        const skillField = skillMap[category];
        if (skillField) {
          const skillValue = typeof entry.score === 'bigint'
            ? Number(entry.score)
            : entry.score;

          await createSkillSnapshot(
            character.id,
            skillField,
            skillValue,
            entry.rank,
            date
          );
        }
      }

      snapshots++;
    } catch (error) {
      console.error(`Error processing ${entry.characterName}:`, error);
    }
  }

  return { upserted, snapshots };
}

/**
 * Main daily scraper job
 * Scrapes all worlds and categories, saves to database
 */
export async function runDailyHighscoresScraper(): Promise<ScraperJobResult> {
  const startTime = new Date();
  const scrapedDate = new Date();
  scrapedDate.setHours(0, 0, 0, 0); // Set to midnight for consistent date

  const errors: string[] = [];
  let worldsProcessed = 0;
  let categoriesProcessed = 0;
  let totalCharactersUpserted = 0;
  let totalSnapshotsCreated = 0;

  console.log('='.repeat(60));
  console.log('DAILY HIGHSCORES SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started at: ${startTime.toISOString()}`);
  console.log(`Scraping date: ${scrapedDate.toISOString()}`);
  console.log('');

  // VPN reminder
  console.log('REMINDER: Ensure you are connected to VPN before running!');
  console.log('');

  // Check if already scraped today
  const alreadyScraped = await hasScrapedToday();
  if (alreadyScraped) {
    console.warn('WARNING: Already scraped today. Continuing anyway...');
    console.log('');
  }

  try {
    // Initialize browser scraper
    console.log('Initializing browser...');
    await browserScraper.initialize();
    console.log('Browser initialized');
    console.log('');

    const totalPages = WORLDS.length * HIGHSCORE_CATEGORIES.length;
    let currentPage = 0;

    // Loop through all worlds
    for (const world of WORLDS) {
      console.log(`--- Processing World: ${world} ---`);

      let worldCategoriesProcessed = 0;

      // Loop through all categories
      for (const category of HIGHSCORE_CATEGORIES) {
        currentPage++;
        const progress = ((currentPage / totalPages) * 100).toFixed(1);

        console.log(`[${currentPage}/${totalPages}] ${progress}% - Scraping ${world} / ${category}...`);

        try {
          // Fetch and parse highscores using the new scraper
          const scrapedEntries = await scrapeHighscores(world, category);
          console.log(`  Found ${scrapedEntries.length} entries`);

          // Convert to the format expected by processHighscoreEntries
          const entries: HighscoreEntry[] = scrapedEntries.map(entry => ({
            rank: entry.rank,
            characterName: entry.name,
            world: world,
            vocation: entry.vocation as Vocation,
            score: category === 'experience' ? BigInt(entry.value) : entry.value,
            level: entry.level,
          }));

          // Process and save to database
          const { upserted, snapshots } = await processHighscoreEntries(
            entries,
            category,
            scrapedDate
          );

          totalCharactersUpserted += upserted;
          totalSnapshotsCreated += snapshots;
          worldCategoriesProcessed++;
          categoriesProcessed++;

          console.log(`  Processed: ${upserted} characters, ${snapshots} snapshots`);

          // Calculate ETA
          const elapsed = Date.now() - startTime.getTime();
          const avgTimePerPage = elapsed / currentPage;
          const remainingPages = totalPages - currentPage;
          const etaMs = avgTimePerPage * remainingPages;
          const etaMinutes = Math.ceil(etaMs / 60000);
          console.log(`  ETA: ~${etaMinutes} minutes remaining`);

          // Polite delay between requests
          if (currentPage < totalPages) {
            console.log(`  Waiting ${DELAY_BETWEEN_REQUESTS}ms...`);
            await delay(DELAY_BETWEEN_REQUESTS);
          }

        } catch (error) {
          const errorMsg = `Failed to scrape ${world}/${category}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`  ERROR: ${errorMsg}`);
          errors.push(errorMsg);
        }

        console.log('');
      }

      worldsProcessed++;
      console.log(`Completed ${world}: ${worldCategoriesProcessed}/${HIGHSCORE_CATEGORIES.length} categories`);
      console.log('');
    }

  } catch (error) {
    const errorMsg = `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  } finally {
    // Get final stats
    const totalCharacters = await getTotalCharactersTracked();
    const snapshotsToday = await getSnapshotsCreatedToday();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const durationMinutes = (duration / 60000).toFixed(2);

    // Summary
    console.log('='.repeat(60));
    console.log('SCRAPER JOB SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${errors.length === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS'}`);
    console.log(`Started: ${startTime.toISOString()}`);
    console.log(`Ended: ${endTime.toISOString()}`);
    console.log(`Duration: ${durationMinutes} minutes`);
    console.log('');
    console.log('Results:');
    console.log(`  - Worlds processed: ${worldsProcessed}/${WORLDS.length}`);
    console.log(`  - Categories processed: ${categoriesProcessed}/${WORLDS.length * HIGHSCORE_CATEGORIES.length}`);
    console.log(`  - Characters upserted: ${totalCharactersUpserted}`);
    console.log(`  - Snapshots created: ${totalSnapshotsCreated}`);
    console.log('');
    console.log('Database Stats:');
    console.log(`  - Total characters tracked: ${totalCharacters}`);
    console.log(`  - Total snapshots today: ${snapshotsToday}`);
    console.log('');

    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
      errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    } else {
      console.log('No errors encountered');
    }
    console.log('='.repeat(60));

    const summary = `Processed ${worldsProcessed} worlds, ${categoriesProcessed} categories. ` +
      `Upserted ${totalCharactersUpserted} characters, created ${totalSnapshotsCreated} snapshots. ` +
      `Duration: ${durationMinutes} min. Errors: ${errors.length}`;

    return {
      success: errors.length === 0,
      startTime,
      endTime,
      duration,
      worldsProcessed,
      categoriesProcessed,
      charactersUpserted: totalCharactersUpserted,
      snapshotsCreated: totalSnapshotsCreated,
      errors,
      summary,
    };
  }
}
