/**
 * Application constants for RubinOT character tracking platform
 */

/** Available worlds on RubinOT server */
export const WORLDS = [
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
] as const;

/** Character vocations */
export const VOCATIONS = [
  'Knight',
  'Elite Knight',
  'Paladin',
  'Royal Paladin',
  'Sorcerer',
  'Master Sorcerer',
  'Druid',
  'Elder Druid',
  'None',
] as const;

/** Character skills tracked in the system */
export const SKILLS = [
  'magic_level',
  'fist',
  'club',
  'sword',
  'axe',
  'distance',
  'shielding',
  'fishing',
] as const;

/** Highscore categories for market statistics (9 types) */
export const HIGHSCORE_CATEGORIES = [
  'experience',
  'magic',
  'fist',
  'club',
  'sword',
  'axe',
  'distance',
  'shielding',
  'fishing',
] as const;

/** RubinOT website URLs */
export const RUBINOT_URLS = {
  base: 'https://rubinot.com.br',
  highscores: '/?subtopic=highscores',
  characters: '/?subtopic=characters',
  currentAuctions: '/currentcharactertrades',
  pastAuctions: '/pastcharactertrades',
  worlds: '/?subtopic=worlds',
} as const;

/** Web scraper configuration */
export const SCRAPER_CONFIG = {
  /** Delay between requests in milliseconds */
  delayMs: 1500,
  /** Maximum retry attempts for failed requests */
  maxRetries: 3,
  /** Cache validity period in hours */
  cacheHours: 1,
} as const;

/** Deal score thresholds for auction value assessment */
export const DEAL_SCORE = {
  /** Score >= 30 indicates a "Great Deal" */
  great: 30,
  /** Score >= 10 indicates a "Good Deal" */
  good: 10,
  /** Score >= -10 indicates a "Fair" deal */
  fair: -10,
  /** Score < -10 indicates "Overpriced" */
} as const;

/** Type exports for use in other modules */
export type World = (typeof WORLDS)[number];
export type Vocation = (typeof VOCATIONS)[number];
export type Skill = (typeof SKILLS)[number];
export type HighscoreCategory = (typeof HIGHSCORE_CATEGORIES)[number];
export type DealScoreVariant = 'great' | 'good' | 'fair' | 'overpriced';
