// Rubinot Exercise Weapon Skill Calculator
// Multiplier tables and formulas specific to Rubinot server

// --- Multiplier Tables ---

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

// --- Exercise Weapon Types ---

export const WEAPON_TYPES = [
  { name: 'Regular', charges: 500, rcCost: 40 },
  { name: 'Durable', charges: 1800, rcCost: 80 },
  { name: 'Lasting', charges: 14400, rcCost: 190 },
  { name: 'Daily', charges: 45000, rcCost: 390 },
] as const;

// --- Skill Categories ---

export type SkillCategory = 'magic' | 'melee' | 'distance';

export const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'magic', label: 'Magic Level (Druid/Sorcerer)' },
  { value: 'melee', label: 'Melee (Sword/Axe/Club/Fist)' },
  { value: 'distance', label: 'Distance (Paladin)' },
];

// --- Tibia Base Formula Constants ---
// In Tibia, the number of tries needed to advance from skill N to N+1:
//   tries(N) = A * B^N
// Where A and B depend on skill type and vocation.

// For exercise weapons on a training dummy, each charge = 1 skill try
// (on private dummy = slightly more effective)

// Standard Tibia base values (adjusted by Rubinot multiplier):
const SKILL_FORMULA: Record<SkillCategory, { A: number; B: number }> = {
  // Magic Level: A=1600, B=1.1 (for druids/sorcerers with mana-based training)
  // For exercise weapons, the formula is simpler: each try counts toward advancing
  magic: { A: 1600, B: 1.1 },
  // Melee skills (knight-focused): A=50, B=1.1
  melee: { A: 50, B: 1.1 },
  // Distance (paladin): A=30, B=1.1
  distance: { A: 30, B: 1.1 },
};

// --- Core Calculation Functions ---

function getMultiplier(skill: number, category: SkillCategory): number {
  const table = category === 'magic' ? MAGIC_MULTIPLIERS : SKILL_MULTIPLIERS;
  for (const range of table) {
    if (skill >= range.from && skill <= range.to) {
      return range.multiplier;
    }
  }
  // Beyond table range, use lowest multiplier
  return table[table.length - 1].multiplier;
}

/**
 * Calculate base tries needed to advance from skill level `level` to `level + 1`
 * without any multipliers applied.
 */
function baseTriesForLevel(level: number, category: SkillCategory): number {
  const { A, B } = SKILL_FORMULA[category];
  return A * Math.pow(B, level);
}

/**
 * Calculate effective tries needed to advance from skill `level` to `level + 1`,
 * applying the Rubinot multiplier for that skill range.
 * The multiplier divides the required tries (higher multiplier = fewer tries needed).
 */
function effectiveTriesForLevel(level: number, category: SkillCategory): number {
  const base = baseTriesForLevel(level, category);
  const multiplier = getMultiplier(level, category);
  return base / multiplier;
}

/**
 * Calculate total effective tries needed to go from `currentSkill` to `targetSkill`.
 * `percentToNext` is 0-100, representing progress toward the next level.
 */
function totalTriesNeeded(
  currentSkill: number,
  percentToNext: number,
  targetSkill: number,
  category: SkillCategory
): number {
  if (targetSkill <= currentSkill) return 0;

  let total = 0;

  // Remaining tries for current level (subtract already-done percentage)
  const currentLevelTries = effectiveTriesForLevel(currentSkill, category);
  total += currentLevelTries * (1 - percentToNext / 100);

  // Full levels from currentSkill+1 to targetSkill-1
  for (let level = currentSkill + 1; level < targetSkill; level++) {
    total += effectiveTriesForLevel(level, category);
  }

  return total;
}

/**
 * Apply modifier multipliers to get effective charges per actual charge.
 * Each charge on a dummy = 1 skill try.
 * Modifiers increase the effective value of each charge.
 */
function chargesPerTry(
  loyaltyPercent: number,
  doubleEvent: boolean,
  privateDummy: boolean,
  vip: boolean
): number {
  let modifier = 1;

  // Loyalty bonus: adds percentage to skill gain
  modifier *= 1 + loyaltyPercent / 100;

  // Double event: doubles skill gain
  if (doubleEvent) modifier *= 2;

  // Private dummy: ~10% more effective (Tibia standard)
  if (privateDummy) modifier *= 1.1;

  // VIP: 10% increase in exercise weapon speed
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
 * currentSkill to targetSkill.
 */
export function calculateWeaponsNeeded(
  category: SkillCategory,
  currentSkill: number,
  percentToNext: number,
  targetSkill: number,
  modifiers: CalculatorModifiers
): WeaponsNeededResult {
  const tries = totalTriesNeeded(currentSkill, percentToNext, targetSkill, category);
  const effectivePerCharge = chargesPerTry(
    modifiers.loyaltyPercent,
    modifiers.doubleEvent,
    modifiers.privateDummy,
    modifiers.vip
  );

  const totalCharges = Math.ceil(tries / effectivePerCharge);

  const weapons = WEAPON_TYPES.map((w) => ({
    name: w.name,
    count: Math.ceil(totalCharges / w.charges),
  }));

  // Each charge takes ~2 seconds on a dummy
  const secondsPerCharge = 2;
  const estimatedHours = (totalCharges * secondsPerCharge) / 3600;

  return { totalCharges, weapons, estimatedHours };
}

/**
 * Mode 2: Calculate how much skill you gain from a given number of weapons.
 */
export function calculateSkillGain(
  category: SkillCategory,
  weaponType: number, // index into WEAPON_TYPES
  weaponCount: number,
  currentSkill: number,
  percentToNext: number,
  modifiers: CalculatorModifiers
): SkillGainResult {
  const charges = WEAPON_TYPES[weaponType].charges * weaponCount;
  const effectivePerCharge = chargesPerTry(
    modifiers.loyaltyPercent,
    modifiers.doubleEvent,
    modifiers.privateDummy,
    modifiers.vip
  );

  let remainingTries = charges * effectivePerCharge;
  let skill = currentSkill;
  let percent = percentToNext;

  // Subtract what's already done on current level
  const currentLevelTries = effectiveTriesForLevel(skill, category);
  const remainingForCurrentLevel = currentLevelTries * (1 - percent / 100);

  if (remainingTries >= remainingForCurrentLevel) {
    remainingTries -= remainingForCurrentLevel;
    skill++;
    percent = 0;
  } else {
    // Not enough to level up — just add to percentage
    const progressAdded = (remainingTries / currentLevelTries) * 100;
    return {
      finalSkill: skill,
      finalPercent: Math.min(99.99, percent + progressAdded),
      levelsGained: 0,
    };
  }

  // Keep leveling up while we have tries left
  while (remainingTries > 0 && skill < 300) {
    const triesForThisLevel = effectiveTriesForLevel(skill, category);
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
