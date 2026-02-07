/**
 * Main scraper module exports
 */

export { BrowserScraper, browserScraper, fetchPage } from './browser';
export {
  parseHighscoresPage,
  scrapeHighscores,
  scrapeHighscoresAllWorlds,
  scrapeHighscoresAllCategories,
} from './highscores';
export {
  parseCharacterPage,
  scrapeCharacter,
  scrapeCharacters,
  extractCharacterNames,
} from './characters';
export {
  parseAuctionPage,
  parseAuctionForDb,
  parseAuctionList,
  scrapeAuction,
  scrapeAuctions,
  scrapeAuctionList,
  scrapeAllCurrentAuctions,
  type AuctionDbData,
} from './auctions';
export {
  fetchAndParse,
  retryWithBackoff,
  extractNumber,
  cleanText,
  parseSkillValue,
  checkScraperHealth,
  shutdownScraper,
} from './utils';
export {
  upsertCharacter,
  createSnapshot,
  createSkillSnapshot,
  calculateExpGained,
  hasScrapedToday,
  getTotalCharactersTracked,
  getSnapshotsCreatedToday,
  upsertAuction,
  getTotalAuctions,
  getAuctionsByStatus,
} from './db-sync';
export { runDailyHighscoresScraper } from './jobs/daily-highscores';

export type {
  ScraperConfig,
  ScraperResult,
  PageOptions,
  CloudflareDetection,
  ScraperStats,
  BrowserSession,
  CookieStorage,
  HighscoreEntry,
  CharacterData,
  AuctionData,
} from './types';
