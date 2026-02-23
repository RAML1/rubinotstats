// Rubinot Exercise Weapon Skill Calculator
// Uses standard Tibia formulas with vocation-specific training rates
// and Rubinot server multipliers.
//
// Base formula: tries(N) = A * b^(N - offset)
// Where:
//   A = skill constant (same for all vocations, varies by skill type)
//   b = vocation constant (varies by vocation AND skill type)
//   offset = 0 for magic level, 10 for all other skills

// --- Rubinot Server Multiplier Tables ---

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

// --- Tibia Formula Constants ---

// Skill constant A (same for all vocations)
const SKILL_CONSTANTS: Record<SkillCategory, number> = {
  magic: 1600,
  shielding: 100,
  sword: 50,
  axe: 50,
  club: 50,
  fist: 50,
  distance: 30,
};

// Skill offset (0 for magic, 10 for everything else)
const SKILL_OFFSET: Record<SkillCategory, number> = {
  magic: 0,
  sword: 10,
  axe: 10,
  club: 10,
  fist: 10,
  distance: 10,
  shielding: 10,
};

// Vocation constant b — lower = faster advancement
// Source: TibiaWiki Formulae + TibiaPal open-source calculator
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

// --- Core Calculation Functions ---

function getRubinotMultiplier(skill: number, category: SkillCategory): number {
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
 * Base tries needed to advance from skill level `level` to `level + 1`
 * for a specific vocation (without Rubinot multiplier).
 */
function baseTriesForLevel(level: number, category: SkillCategory, vocation: Vocation): number {
  const A = SKILL_CONSTANTS[category];
  const b = VOCATION_CONSTANTS[vocation][category];
  const offset = SKILL_OFFSET[category];
  return A * Math.pow(b, level - offset);
}

/**
 * Effective tries needed after applying Rubinot server multiplier.
 */
function effectiveTriesForLevel(level: number, category: SkillCategory, vocation: Vocation): number {
  const base = baseTriesForLevel(level, category, vocation);
  const multiplier = getRubinotMultiplier(level, category);
  return base / multiplier;
}

/**
 * Total effective tries to go from currentSkill (with percentToNext progress)
 * to targetSkill.
 */
function totalTriesNeeded(
  currentSkill: number,
  percentToNext: number,
  targetSkill: number,
  category: SkillCategory,
  vocation: Vocation,
): number {
  if (targetSkill <= currentSkill) return 0;

  let total = 0;

  // Remaining tries for current level (subtract already-done percentage)
  const currentLevelTries = effectiveTriesForLevel(currentSkill, category, vocation);
  total += currentLevelTries * (1 - percentToNext / 100);

  // Full levels from currentSkill+1 to targetSkill-1
  for (let level = currentSkill + 1; level < targetSkill; level++) {
    total += effectiveTriesForLevel(level, category, vocation);
  }

  return total;
}

/**
 * Apply modifier multipliers.
 * Each charge on a dummy = 1 skill try.
 * Modifiers increase the effective value of each charge.
 */
function chargesPerTry(
  loyaltyPercent: number,
  doubleEvent: boolean,
  privateDummy: boolean,
  vip: boolean,
): number {
  let modifier = 1;
  modifier *= 1 + loyaltyPercent / 100;
  if (doubleEvent) modifier *= 2;
  if (privateDummy) modifier *= 1.1;
  if (vip) modifier *= 1.1;
  return modifier;
}

// --- Public API ---

export interface CalculatorModifiers {
  loyaltyPercent: number;
  doubleEvent: boolean;
  privateDummy: boolean;
  vip: boolean;
}

export interface WeaponsNeededResult {
  totalCharges: number;
  weapons: { name: string; count: number }[];
  estimatedHours: number;
}

export interface SkillGainResult {
  finalSkill: number;
  finalPercent: number;
  levelsGained: number;
}

/**
 * Mode 1: Calculate how many exercise weapons are needed to go from
 * currentSkill to targetSkill for a given vocation.
 */
export function calculateWeaponsNeeded(
  category: SkillCategory,
  vocation: Vocation,
  currentSkill: number,
  percentToNext: number,
  targetSkill: number,
  modifiers: CalculatorModifiers,
): WeaponsNeededResult {
  const tries = totalTriesNeeded(currentSkill, percentToNext, targetSkill, category, vocation);
  const effectivePerCharge = chargesPerTry(
    modifiers.loyaltyPercent,
    modifiers.doubleEvent,
    modifiers.privateDummy,
    modifiers.vip,
  );

  const totalCharges = Math.ceil(tries / effectivePerCharge);

  const weapons = WEAPON_TYPES.map((w) => ({
    name: w.name,
    count: Math.ceil(totalCharges / w.charges),
  }));

  // Each charge takes ~2 seconds on a dummy
  const estimatedHours = (totalCharges * 2) / 3600;

  return { totalCharges, weapons, estimatedHours };
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
  percentToNext: number,
  modifiers: CalculatorModifiers,
): SkillGainResult {
  const charges = WEAPON_TYPES[weaponType].charges * weaponCount;
  const effectivePerCharge = chargesPerTry(
    modifiers.loyaltyPercent,
    modifiers.doubleEvent,
    modifiers.privateDummy,
    modifiers.vip,
  );

  let remainingTries = charges * effectivePerCharge;
  let skill = currentSkill;
  let percent = percentToNext;

  // Subtract what's already done on current level
  const currentLevelTries = effectiveTriesForLevel(skill, category, vocation);
  const remainingForCurrentLevel = currentLevelTries * (1 - percent / 100);

  if (remainingTries >= remainingForCurrentLevel) {
    remainingTries -= remainingForCurrentLevel;
    skill++;
    percent = 0;
  } else {
    const progressAdded = (remainingTries / currentLevelTries) * 100;
    return {
      finalSkill: skill,
      finalPercent: Math.min(99.99, percent + progressAdded),
      levelsGained: 0,
    };
  }

  // Keep leveling up while we have tries left
  while (remainingTries > 0 && skill < 300) {
    const triesForThisLevel = effectiveTriesForLevel(skill, category, vocation);
    if (remainingTries >= triesForThisLevel) {
      remainingTries -= triesForThisLevel;
      skill++;
    } else {
      percent = (remainingTries / triesForThisLevel) * 100;
      remainingTries = 0;
    }
  }

  return {
    finalSkill: skill,
    finalPercent: Math.round(percent * 100) / 100,
    levelsGained: skill - currentSkill,
  };
}

/**
 * Get the display multiplier for the current skill level.
 */
export function getMultiplierForDisplay(skill: number, category: SkillCategory): number {
  return getRubinotMultiplier(skill, category);
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
