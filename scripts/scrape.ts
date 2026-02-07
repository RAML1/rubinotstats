#!/usr/bin/env tsx
/**
 * On-demand scraper CLI
 *
 * Usage:
 *   pnpm scrape                    # Scrape experience highscores (all worlds)
 *   pnpm scrape --world Elysian    # Scrape specific world
 *   pnpm scrape --category magic   # Scrape specific category
 *   pnpm scrape --character "Name" # Scrape specific character
 *   pnpm scrape --full             # Full daily scrape (all worlds, all categories)
 *
 * IMPORTANT: Make sure VPN is connected before running!
 */

import {
  scrapeHighscores,
  scrapeHighscoresAllWorlds,
  scrapeHighscoresAllCategories,
  scrapeCharacter,
  browserScraper,
  shutdownScraper
} from '../src/lib/scraper';

// Parse command line arguments
const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           RubinOT Stats - On-Demand Scraper               ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  ⚠️  Make sure your VPN is connected before proceeding!   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  try {
    // Character lookup mode
    const characterName = getArg('--character') || getArg('-c');
    if (characterName) {
      console.log(`Looking up character: ${characterName}`);
      const character = await scrapeCharacter(characterName);

      if (character) {
        console.log('\n=== Character Found ===');
        console.log(JSON.stringify(character, null, 2));
      } else {
        console.log('\nCharacter not found or page could not be parsed.');
      }

      await shutdownScraper();
      return;
    }

    // Full scrape mode
    if (hasFlag('--full')) {
      console.log('Running FULL daily scrape (all worlds, all categories)');
      console.log('This will take approximately 3-5 minutes...\n');

      const worlds = [
        'Elysian', 'Lunarian', 'Mystian', 'Serenian',
        'Serenian II', 'Serenian III', 'Serenian IV',
        'Solarian', 'Spectrum', 'Tenebrium', 'Vesperia',
      ];

      let totalEntries = 0;

      for (const world of worlds) {
        console.log(`\n--- Scraping ${world} ---`);
        const results = await scrapeHighscoresAllCategories(world);

        for (const [category, entries] of Object.entries(results)) {
          totalEntries += entries.length;
          console.log(`  ${category}: ${entries.length} entries`);
        }
      }

      console.log(`\n✅ Full scrape complete! Total entries: ${totalEntries}`);
      await shutdownScraper();
      return;
    }

    // Single world/category mode
    const world = getArg('--world') || getArg('-w') || '';
    const category = getArg('--category') || getArg('-cat') || 'experience';

    if (world) {
      console.log(`Scraping highscores for world: ${world}, category: ${category}`);
      const entries = await scrapeHighscores(world, category);

      console.log(`\n✅ Scraped ${entries.length} entries`);

      // Show top 10
      if (entries.length > 0) {
        console.log('\nTop 10:');
        entries.slice(0, 10).forEach((entry, i) => {
          console.log(`  ${i + 1}. ${entry.name} (${entry.vocation}) - Level ${entry.level} - ${entry.value.toLocaleString()}`);
        });
      }
    } else {
      console.log(`Scraping ${category} highscores for ALL worlds...`);
      const entries = await scrapeHighscoresAllWorlds(category);

      console.log(`\n✅ Scraped ${entries.length} total entries`);

      // Show top 10 overall
      if (entries.length > 0) {
        entries.sort((a, b) => b.value - a.value);
        console.log('\nTop 10 Overall:');
        entries.slice(0, 10).forEach((entry, i) => {
          console.log(`  ${i + 1}. ${entry.name} [${entry.world}] (${entry.vocation}) - Level ${entry.level} - ${entry.value.toLocaleString()}`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Scraper error:', error);
    process.exit(1);
  } finally {
    await shutdownScraper();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s`);
  }
}

main();
