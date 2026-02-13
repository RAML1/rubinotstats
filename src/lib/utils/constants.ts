/**
 * Application constants for RubinOT character tracking platform
 */

/** Available worlds on RubinOT server */
export const WORLDS = [
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
  'Monk',
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

/** Highscore categories available on the site (name → form value) */
export const HIGHSCORE_CATEGORIES = {
  'Experience Points': '6',
  'Magic Level': '11',
  'Fist Fighting': '8',
  'Club Fighting': '4',
  'Sword Fighting': '13',
  'Axe Fighting': '2',
  'Distance Fighting': '5',
  'Shielding': '12',
  'Fishing': '7',
  'Achievements': '17',
  'Battle Pass': '18',
  'Bounty Points': '22',
  'Charm Points': '19',
  'Drome Score': '14',
  'Linked Tasks': '15',
  'Daily Experience (raw)': '16',
  'Loyalty Points': '10',
  'Prestige Points': '20',
  'Weekly Tasks': '21',
} as const;

/** Shorthand category keys for CLI use */
export const CATEGORY_ALIASES: Record<string, keyof typeof HIGHSCORE_CATEGORIES> = {
  experience: 'Experience Points',
  exp: 'Experience Points',
  magic: 'Magic Level',
  ml: 'Magic Level',
  fist: 'Fist Fighting',
  club: 'Club Fighting',
  sword: 'Sword Fighting',
  axe: 'Axe Fighting',
  distance: 'Distance Fighting',
  shielding: 'Shielding',
  fishing: 'Fishing',
  achievements: 'Achievements',
  battlepass: 'Battle Pass',
  bounty: 'Bounty Points',
  charm: 'Charm Points',
  drome: 'Drome Score',
  linked: 'Linked Tasks',
  dailyexp: 'Daily Experience (raw)',
  loyalty: 'Loyalty Points',
  prestige: 'Prestige Points',
  weekly: 'Weekly Tasks',
};

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
export type HighscoreCategory = keyof typeof HIGHSCORE_CATEGORIES;
export type DealScoreVariant = 'great' | 'good' | 'fair' | 'overpriced';
