// Rubinot Exercise Weapon Skill Calculator
// Uses the Rubinot-specific formula derived from rubinot-wiki.vercel.app
//
// Formula: pointsForLevel(L) = 1600 * b^L
// Where:
//   1600 = universal skill constant (same for all skills)
//   b = vocation constant (varies by vocation AND skill type)
//   L = current skill level (no offset)
//
// Each exercise weapon charge provides 600 skill points.
// Stage multipliers divide the points required per level.

// --- Rubinot Server Stage Multiplier Tables ---

export const SKILL_MULTIPLIERS = [
  { from: 1, to: 80, multiplier: 10 },
  { from: 81, to: 100, multiplier: 7 },
  { from: 101, to: 120, multiplier: 4 },
  { from: 121, to: 300, multiplier: 2 },
] as const;

export const MAGIC_MULTIPLIERS = [
  { from: 0, to: 80, multiplier: 10 },
  { from: 81, to: 100, multiplier: 7 },
  { from: 101, to: 120, multiplier: 4 },
  { from: 121, to: 130, multiplier: 3 },
  { from: 131, to: 300, multiplier: 2 },
] as const;

// --- Vocations ---

export type Vocation = 'knight' | 'paladin' | 'sorcerer' | 'druid' | 'monk';

export const VOCATIONS: { value: Vocation; label: string }[] = [
  { value: 'knight', label: 'Knight' },
  { value: 'paladin', label: 'Paladin' },
  { value: 'sorcerer', label: 'Sorcerer' },
  { value: 'druid', label: 'Druid' },
  { value: 'monk', label: 'Monk' },
];

// --- Skill Categories ---

export type SkillCategory = 'magic' | 'sword' | 'axe' | 'club' | 'fist' | 'distance' | 'shielding';

export const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'magic', label: 'Magic Level' },
  { value: 'sword', label: 'Sword Fighting' },
  { value: 'axe', label: 'Axe Fighting' },
  { value: 'club', label: 'Club Fighting' },
  { value: 'distance', label: 'Distance Fighting' },
  { value: 'shielding', label: 'Shielding' },
  { value: 'fist', label: 'Fist Fighting' },
];

// --- Formula Constants ---

// Universal skill constant A = 1600 for all skills
const SKILL_CONSTANT = 1600;

// Points per exercise weapon charge
const POINTS_PER_CHARGE = 600;

// Vocation constant b — lower = faster advancement
const VOCATION_CONSTANTS: Record<Vocation, Record<SkillCategory, number>> = {
  knight: {
    magic: 3.0,
    sword: 1.1,
    axe: 1.1,
    club: 1.1,
    fist: 1.1,
    distance: 1.4,
    shielding: 1.1,
  },
  paladin: {
    magic: 1.4,
    sword: 1.2,
    axe: 1.2,
    club: 1.2,
    fist: 1.2,
    distance: 1.1,
    shielding: 1.1,
  },
  sorcerer: {
    magic: 1.1,
    sword: 2.0,
    axe: 2.0,
    club: 2.0,
    fist: 1.5,
    distance: 2.0,
    shielding: 1.5,
  },
  druid: {
    magic: 1.1,
    sword: 1.8,
    axe: 1.8,
    club: 1.8,
    fist: 1.5,
    distance: 1.8,
    shielding: 1.5,
  },
  monk: {
    magic: 1.25,
    sword: 1.4,
    axe: 1.4,
    club: 1.4,
    fist: 1.1,
    distance: 1.5,
    shielding: 1.15,
  },
};

// --- Exercise Weapon Types ---

export const WEAPON_TYPES = [
  { name: 'Regular', charges: 500, rcCost: 40 },
  { name: 'Durable', charges: 2000, rcCost: 80 },
  { name: 'Lasting', charges: 15000, rcCost: 190 },
  { name: 'Lasting (Daily Reward)', charges: 5000, rcCost: 0 },
  { name: 'Daily', charges: 45000, rcCost: 390 },
] as const;

// --- Time Constants ---

// Seconds per charge for time estimates
const SECONDS_PER_CHARGE = 2;

// Time modifiers (multiply training time)
const TIME_MODIFIERS = {
  exerciseDummy: 0.9, // 10% faster
  doubleEvent: 0.5,   // 2x faster
  vipAccount: 0.9,    // 10% faster
};

// --- Core Calculation Functions ---

function getStageMultiplier(skill: number, category: SkillCategory): number {
  const table = category === 'magic' ? MAGIC_MULTIPLIERS : SKILL_MULTIPLIERS;
  for (const range of table) {
    if (skill >= range.from && skill <= range.to) {
      return range.multiplier;
    }
  }
  return table[table.length - 1].multiplier;
}

/**
 * Get the vocation constant b for a given vocation and skill.
 */
export function getVocationConstant(vocation: Vocation, category: SkillCategory): number {
  return VOCATION_CONSTANTS[vocation][category];
}

/**
 * Raw skill points needed to advance from `level` to `level + 1`
 * (before stage multiplier).
 */
function rawPointsForLevel(level: number, category: SkillCategory, vocation: Vocation): number {
  const b = VOCATION_CONSTANTS[vocation][category];
  return SKILL_CONSTANT * Math.pow(b, level);
}

/**
 * Effective points needed after applying stage multiplier.
 */
function effectivePointsForLevel(level: number, category: SkillCategory, vocation: Vocation): number {
  const raw = rawPointsForLevel(level, category, vocation);
  const multiplier = getStageMultiplier(level, category);
  return raw / multiplier;
}

/**
 * Total effective points to go from currentSkill (with percentToGo remaining)
 * to targetSkill.
 */
function totalPointsNeeded(
  currentSkill: number,
  percentToGo: number,
  targetSkill: number,
  category: SkillCategory,
  vocation: Vocation,
): number {
  if (targetSkill <= currentSkill) return 0;

  let total = 0;

  // Remaining points for current level (percentToGo is how much is LEFT)
  const currentLevelPoints = effectivePointsForLevel(currentSkill, category, vocation);
  total += currentLevelPoints * (percentToGo / 100);

  // Full levels from currentSkill+1 to targetSkill-1
  for (let level = currentSkill + 1; level < targetSkill; level++) {
    total += effectivePointsForLevel(level, category, vocation);
  }

  return total;
}

/**
 * Convert exercise weapon charges to skill points.
 */
function chargesToPoints(charges: number): number {
  return charges * POINTS_PER_CHARGE;
}

// --- Public API ---

export interface CalculatorModifiers {
  privateDummy: boolean;
  doubleEvent: boolean;
  vip: boolean;
}

export interface WeaponsNeededResult {
  totalCharges: number;
  weapons: { name: string; count: number }[];
  estimatedSeconds: number;
}

export interface SkillGainResult {
  finalSkill: number;
  finalPercent: number;
  levelsGained: number;
}

/**
 * Calculate training time in seconds for a given number of charges.
 */
function calculateTrainingTime(charges: number, modifiers: CalculatorModifiers): number {
  let seconds = charges * SECONDS_PER_CHARGE;
  if (modifiers.privateDummy) seconds *= TIME_MODIFIERS.exerciseDummy;
  if (modifiers.doubleEvent) seconds *= TIME_MODIFIERS.doubleEvent;
  if (modifiers.vip) seconds *= TIME_MODIFIERS.vipAccount;
  return seconds;
}

/**
 * Mode 1: Calculate how many exercise weapons are needed to go from
 * currentSkill to targetSkill for a given vocation.
 */
export function calculateWeaponsNeeded(
  category: SkillCategory,
  vocation: Vocation,
  currentSkill: number,
  percentToGo: number,
  targetSkill: number,
  modifiers: CalculatorModifiers,
): WeaponsNeededResult {
  const pointsNeeded = totalPointsNeeded(currentSkill, percentToGo, targetSkill, category, vocation);
  const totalCharges = Math.ceil(pointsNeeded / POINTS_PER_CHARGE);

  const weapons = WEAPON_TYPES.map((w) => ({
    name: w.name,
    count: Math.ceil(totalCharges / w.charges),
  }));

  const estimatedSeconds = calculateTrainingTime(totalCharges, modifiers);

  return { totalCharges, weapons, estimatedSeconds };
}

/**
 * Mode 2: Calculate how much skill you gain from a given number of weapons
 * for a given vocation.
 */
export function calculateSkillGain(
  category: SkillCategory,
  vocation: Vocation,
  weaponType: number,
  weaponCount: number,
  currentSkill: number,
  percentToGo: number,
  modifiers: CalculatorModifiers,
): SkillGainResult {
  const charges = WEAPON_TYPES[weaponType].charges * weaponCount;
  let remainingPoints = chargesToPoints(charges);
  let skill = currentSkill;
  let pctToGo = percentToGo;

  // Points needed to finish current level
  const currentLevelPoints = effectivePointsForLevel(skill, category, vocation);
  const remainingForCurrentLevel = currentLevelPoints * (pctToGo / 100);

  if (remainingPoints >= remainingForCurrentLevel) {
    remainingPoints -= remainingForCurrentLevel;
    skill++;
    pctToGo = 100; // 100% to go on new level (just started)
  } else {
    // Doesn't finish the current level
    const pctAdvanced = (remainingPoints / currentLevelPoints) * 100;
    return {
      finalSkill: skill,
      finalPercent: Math.max(0, Math.round((pctToGo - pctAdvanced) * 100) / 100),
      levelsGained: 0,
    };
  }

  // Keep leveling up while we have points left
  while (remainingPoints > 0 && skill < 300) {
    const pointsForThisLevel = effectivePointsForLevel(skill, category, vocation);
    if (remainingPoints >= pointsForThisLevel) {
      remainingPoints -= pointsForThisLevel;
      skill++;
    } else {
      pctToGo = 100 - (remainingPoints / pointsForThisLevel) * 100;
      remainingPoints = 0;
    }
  }

  if (remainingPoints <= 0 && skill === currentSkill + (pctToGo < 100 ? 0 : 1)) {
    // Didn't advance past initial level-up
  }

  const finalPercent = skill > currentSkill + (percentToGo === 100 ? 0 : 0)
    ? Math.round(pctToGo * 100) / 100
    : Math.round(pctToGo * 100) / 100;

  return {
    finalSkill: skill,
    finalPercent: Math.max(0, finalPercent),
    levelsGained: skill - currentSkill,
  };
}

/**
 * Get the display multiplier for the current skill level.
 */
export function getMultiplierForDisplay(skill: number, category: SkillCategory): number {
  return getStageMultiplier(skill, category);
}

/**
 * Determine which skills are relevant for a given vocation.
 * Returns them sorted by relevance (primary skill first).
 */
export function getRelevantSkills(vocation: Vocation): SkillCategory[] {
  switch (vocation) {
    case 'knight':
      return ['sword', 'axe', 'club', 'shielding', 'magic', 'fist', 'distance'];
    case 'paladin':
      return ['distance', 'magic', 'shielding', 'sword', 'axe', 'club', 'fist'];
    case 'sorcerer':
    case 'druid':
      return ['magic', 'shielding', 'distance', 'sword', 'axe', 'club', 'fist'];
    case 'monk':
      return ['fist', 'shielding', 'magic', 'sword', 'axe', 'club', 'distance'];
  }
}
