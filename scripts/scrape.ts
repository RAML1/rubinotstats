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
 *   pnpm scrape --output ./data    # Save to specific directory (default: ./data)
 *
 *   pnpm scrape --auctions         # Scrape all current auctions
 *   pnpm scrape --auction 135353   # Scrape specific auction by ID
 *
 * IMPORTANT: Make sure VPN is connected before running!
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  scrapeHighscores,
  scrapeHighscoresAllWorlds,
  scrapeHighscoresAllCategories,
  scrapeCharacter,
  scrapeAuction,
  scrapeAllCurrentAuctions,
  shutdownScraper
} from '../src/lib/scraper';

// Get timestamp for filenames
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Ensure output directory exists
function ensureOutputDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created output directory: ${dir}`);
  }
}

// Save data to JSON file
function saveToFile(data: unknown, filename: string, outputDir: string): string {
  ensureOutputDir(outputDir);
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Saved: ${filepath}`);
  return filepath;
}

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

// Get output directory from args or default
const outputDir = getArg('--output') || getArg('-o') || './data';

async function main() {
  console.log('');
  console.log('===========================================================');
  console.log('           RubinOT Stats - On-Demand Scraper               ');
  console.log('===========================================================');
  console.log('  Make sure your VPN is connected before proceeding!       ');
  console.log('===========================================================');
  console.log('');

  const startTime = Date.now();

  try {
    const timestamp = getTimestamp();

    // Single auction mode
    const auctionId = getArg('--auction') || getArg('-a');
    if (auctionId) {
      console.log(`Scraping auction: ${auctionId}`);
      const auction = await scrapeAuction(auctionId);

      if (auction) {
        console.log('\n=== Auction Found ===');
        console.log(`Character: ${auction.characterName}`);
        console.log(`Level: ${auction.level} ${auction.vocation}`);
        console.log(`World: ${auction.world}`);
        console.log('\nSkills:');
        console.log(`  Magic Level: ${auction.magicLevel || 'N/A'}`);
        console.log(`  Distance: ${auction.distance || 'N/A'}`);
        console.log(`  Shielding: ${auction.shielding || 'N/A'}`);
        console.log(`  Sword: ${auction.sword || 'N/A'}`);
        console.log(`  Axe: ${auction.axe || 'N/A'}`);
        console.log(`  Club: ${auction.club || 'N/A'}`);
        console.log(`  Fist: ${auction.fist || 'N/A'}`);
        console.log(`  Fishing: ${auction.fishing || 'N/A'}`);
        console.log('\nCharm Points:');
        console.log(`  Available: ${auction.availableCharmPoints || 'N/A'}`);
        console.log(`  Spent: ${auction.spentCharmPoints || 'N/A'}`);
        console.log('\nProgression:');
        console.log(`  Boss Points: ${auction.bossPoints || 'N/A'}`);
        console.log(`  Exalted Dust: ${auction.exaltedDust || 'N/A'}/${auction.exaltedDustLimit || 'N/A'}`);
        console.log(`  Daily Reward Streak: ${auction.dailyRewardStreak || 'N/A'}`);
        console.log('\nBid Info:');
        console.log(`  Current Bid: ${auction.currentBid || 'N/A'}`);
        console.log(`  Status: ${auction.status}`);

        // Save to file
        const filename = `auction-${auctionId}-${timestamp}.json`;
        saveToFile(auction, filename, outputDir);
      } else {
        console.log('\nAuction not found or page could not be parsed.');
      }

      await shutdownScraper();
      return;
    }

    // All auctions mode
    if (hasFlag('--auctions')) {
      console.log('Scraping ALL current auctions...');
      console.log('This may take several minutes depending on the number of auctions.\n');

      const auctions = await scrapeAllCurrentAuctions();

      console.log(`\n=== Scraped ${auctions.length} auctions ===`);

      if (auctions.length > 0) {
        // Save to file
        const filename = `auctions-${timestamp}.json`;
        saveToFile(auctions, filename, outputDir);

        // Summary by vocation
        const byVocation: Record<string, number> = {};
        for (const a of auctions) {
          const voc = a.vocation || 'Unknown';
          byVocation[voc] = (byVocation[voc] || 0) + 1;
        }

        console.log('\nBy Vocation:');
        for (const [voc, count] of Object.entries(byVocation)) {
          console.log(`  ${voc}: ${count}`);
        }

        // Top 5 by level
        const sorted = [...auctions].sort((a, b) => (b.level || 0) - (a.level || 0));
        console.log('\nTop 5 by Level:');
        sorted.slice(0, 5).forEach((a, i) => {
          console.log(`  ${i + 1}. ${a.characterName} - Level ${a.level} ${a.vocation} (Bid: ${a.currentBid || 'N/A'})`);
        });
      }

      await shutdownScraper();
      return;
    }

    // Character lookup mode
    const characterName = getArg('--character') || getArg('-c');
    if (characterName) {
      console.log(`Looking up character: ${characterName}`);
      const character = await scrapeCharacter(characterName);

      if (character) {
        console.log('\n=== Character Found ===');
        console.log(JSON.stringify(character, null, 2));

        // Save to file
        const filename = `character-${characterName.replace(/\s+/g, '_')}-${timestamp}.json`;
        saveToFile(character, filename, outputDir);
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
      const allResults: Record<string, Record<string, unknown[]>> = {};

      for (const world of worlds) {
        console.log(`\n--- Scraping ${world} ---`);
        const results = await scrapeHighscoresAllCategories(world);
        allResults[world] = results;

        for (const [category, entries] of Object.entries(results)) {
          totalEntries += entries.length;
          console.log(`  ${category}: ${entries.length} entries`);
        }
      }

      // Save full results
      const filename = `highscores-full-${timestamp}.json`;
      saveToFile(allResults, filename, outputDir);

      console.log(`\nFull scrape complete! Total entries: ${totalEntries}`);
      await shutdownScraper();
      return;
    }

    // Single world/category mode
    const world = getArg('--world') || getArg('-w') || '';
    const category = getArg('--category') || getArg('-cat') || 'experience';

    if (world) {
      console.log(`Scraping highscores for world: ${world}, category: ${category}`);
      const entries = await scrapeHighscores(world, category);

      console.log(`\nScraped ${entries.length} entries`);

      // Save to file
      if (entries.length > 0) {
        const filename = `highscores-${world.replace(/\s+/g, '_')}-${category}-${timestamp}.json`;
        saveToFile(entries, filename, outputDir);

        console.log('\nTop 10:');
        entries.slice(0, 10).forEach((entry, i) => {
          console.log(`  ${i + 1}. ${entry.name} (${entry.vocation}) - Level ${entry.level} - ${entry.value.toLocaleString()}`);
        });
      }
    } else {
      console.log(`Scraping ${category} highscores for ALL worlds...`);
      const entries = await scrapeHighscoresAllWorlds(category);

      console.log(`\nScraped ${entries.length} total entries`);

      // Save to file
      if (entries.length > 0) {
        entries.sort((a, b) => b.value - a.value);
        const filename = `highscores-all-worlds-${category}-${timestamp}.json`;
        saveToFile(entries, filename, outputDir);

        console.log('\nTop 10 Overall:');
        entries.slice(0, 10).forEach((entry, i) => {
          console.log(`  ${i + 1}. ${entry.name} [${entry.world}] (${entry.vocation}) - Level ${entry.level} - ${entry.value.toLocaleString()}`);
        });
      }
    }

  } catch (error) {
    console.error('\nScraper error:', error);
    process.exit(1);
  } finally {
    await shutdownScraper();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s`);
  }
}

main();
