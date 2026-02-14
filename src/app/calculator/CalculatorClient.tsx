'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Calculator, Swords, Target, Clock, Zap, Shield, Crown } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import {
  calculateWeaponsNeeded,
  calculateSkillGain,
  SKILL_CATEGORIES,
  WEAPON_TYPES,
  SKILL_MULTIPLIERS,
  MAGIC_MULTIPLIERS,
  type SkillCategory,
  type CalculatorModifiers,
  type WeaponsNeededResult,
  type SkillGainResult,
} from '@/lib/utils/skill-calculator';

type Mode = 'target' | 'weapons';

const LOYALTY_OPTIONS = Array.from({ length: 11 }, (_, i) => i * 5);

export default function CalculatorClient() {
  // Mode
  const [mode, setMode] = useState<Mode>('target');

  // Shared inputs
  const [category, setCategory] = useState<SkillCategory>('magic');
  const [currentSkill, setCurrentSkill] = useState<string>('10');
  const [percentToNext, setPercentToNext] = useState<string>('0');
  const [loyaltyPercent, setLoyaltyPercent] = useState<number>(0);
  const [doubleEvent, setDoubleEvent] = useState(false);
  const [privateDummy, setPrivateDummy] = useState(false);
  const [vip, setVip] = useState(false);

  // Mode 1: Target skill
  const [targetSkill, setTargetSkill] = useState<string>('100');

  // Mode 2: Weapons count
  const [weaponType, setWeaponType] = useState<number>(0);
  const [weaponCount, setWeaponCount] = useState<string>('1');

  const modifiers: CalculatorModifiers = {
    loyaltyPercent,
    doubleEvent,
    privateDummy,
    vip,
  };

  const current = parseInt(currentSkill, 10) || 0;
  const percent = parseFloat(percentToNext) || 0;
  const target = parseInt(targetSkill, 10) || 0;
  const count = parseInt(weaponCount, 10) || 0;

  // Mode 1 result
  const weaponsResult: WeaponsNeededResult | null = useMemo(() => {
    if (mode !== 'target' || current <= 0 || target <= current) return null;
    return calculateWeaponsNeeded(category, current, percent, target, modifiers);
  }, [mode, category, current, percent, target, modifiers.loyaltyPercent, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

  // Mode 2 result
  const skillResult: SkillGainResult | null = useMemo(() => {
    if (mode !== 'weapons' || current <= 0 || count <= 0) return null;
    return calculateSkillGain(category, weaponType, count, current, percent, modifiers);
  }, [mode, category, weaponType, count, current, percent, modifiers.loyaltyPercent, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

  const multiplierTable = category === 'magic' ? MAGIC_MULTIPLIERS : SKILL_MULTIPLIERS;

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('target')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
            mode === 'target'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/50 border border-border/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Target className="w-4 h-4 inline-block mr-2" />
          Weapons Needed
        </button>
        <button
          onClick={() => setMode('weapons')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
            mode === 'weapons'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card/50 border border-border/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          <Swords className="w-4 h-4 inline-block mr-2" />
          Skill Gain
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur lg:col-span-2">
          <div className="flex items-center gap-2 p-6 pb-0">
            <Calculator className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {mode === 'target' ? 'Calculate Weapons Needed' : 'Calculate Skill Gain'}
            </h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Skill Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Skill Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SkillCategory)}
                className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Skill + Percent */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Skill</label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={currentSkill}
                  onChange={(e) => setCurrentSkill(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">% to Next Level</label>
                <input
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.01}
                  value={percentToNext}
                  onChange={(e) => setPercentToNext(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Mode-specific inputs */}
            {mode === 'target' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Skill</label>
                <input
                  type="number"
                  min={(current || 0) + 1}
                  max={300}
                  value={targetSkill}
                  onChange={(e) => setTargetSkill(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Weapon Type</label>
                  <select
                    value={weaponType}
                    onChange={(e) => setWeaponType(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {WEAPON_TYPES.map((w, i) => (
                      <option key={w.name} value={i}>
                        {w.name} ({formatNumber(w.charges)} charges)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Number of Weapons</label>
                  <input
                    type="number"
                    min={1}
                    value={weaponCount}
                    onChange={(e) => setWeaponCount(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border/30" />

            {/* Modifiers */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Modifiers
              </h3>

              {/* Loyalty */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Loyalty Bonus</label>
                <select
                  value={loyaltyPercent}
                  onChange={(e) => setLoyaltyPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {LOYALTY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/30 cursor-pointer hover:border-border/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={doubleEvent}
                    onChange={(e) => setDoubleEvent(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-500" />
                      Double Event
                    </div>
                    <div className="text-xs text-muted-foreground">2x skill gain</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/30 cursor-pointer hover:border-border/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={privateDummy}
                    onChange={(e) => setPrivateDummy(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      Private Dummy
                    </div>
                    <div className="text-xs text-muted-foreground">+10% effectiveness</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border/30 cursor-pointer hover:border-border/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={vip}
                    onChange={(e) => setVip(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      VIP Account
                    </div>
                    <div className="text-xs text-muted-foreground">+10% weapon speed</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Results Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <div className="flex items-center gap-2 p-6 pb-0">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Results</h2>
          </div>

          <div className="p-6">
            {mode === 'target' && weaponsResult && (
              <div className="space-y-5">
                {/* Total Charges */}
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Total Charges Needed
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {formatNumber(weaponsResult.totalCharges)}
                  </div>
                </div>

                {/* Weapons Breakdown */}
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Weapons Required
                  </div>
                  {weaponsResult.weapons.map((w) => (
                    <div
                      key={w.name}
                      className="flex justify-between items-center p-3 bg-background/30 rounded-lg"
                    >
                      <span className="text-sm font-medium">{w.name}</span>
                      <span className="text-sm font-bold text-primary">
                        {formatNumber(w.count)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Estimated Time */}
                <div className="border-t border-border/30 pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Estimated time:</span>
                    <span className="font-medium">
                      {weaponsResult.estimatedHours < 1
                        ? `${Math.round(weaponsResult.estimatedHours * 60)} minutes`
                        : weaponsResult.estimatedHours < 24
                          ? `${Math.round(weaponsResult.estimatedHours)} hours`
                          : `${Math.round(weaponsResult.estimatedHours / 24)} days ${Math.round(weaponsResult.estimatedHours % 24)}h`}
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-border/30 pt-4 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>From</span>
                    <span>Skill {current} ({percent}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>To</span>
                    <span>Skill {target}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current multiplier</span>
                    <span>{getMultiplierForDisplay(current, category)}x</span>
                  </div>
                </div>
              </div>
            )}

            {mode === 'weapons' && skillResult && (
              <div className="space-y-5">
                {/* Final Skill */}
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Final Skill Level
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {skillResult.finalSkill}
                    <span className="text-lg text-muted-foreground ml-1">
                      ({skillResult.finalPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Levels Gained */}
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Levels Gained
                  </div>
                  <div className="text-3xl font-bold text-emerald-500">
                    +{skillResult.levelsGained}
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-border/30 pt-4 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Weapon</span>
                    <span>
                      {count}x {WEAPON_TYPES[weaponType].name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total charges</span>
                    <span>{formatNumber(WEAPON_TYPES[weaponType].charges * count)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current multiplier</span>
                    <span>{getMultiplierForDisplay(current, category)}x</span>
                  </div>
                </div>
              </div>
            )}

            {/* No result state */}
            {((mode === 'target' && !weaponsResult) || (mode === 'weapons' && !skillResult)) && (
              <div className="text-center py-12">
                <Calculator className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {mode === 'target'
                    ? 'Enter a current skill and target skill to calculate.'
                    : 'Enter your current skill and number of weapons to calculate.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Multiplier Reference Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur mt-6">
        <div className="flex items-center gap-2 p-6 pb-0">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">
            RubinOT {category === 'magic' ? 'Magic Level' : 'Skill'} Multiplier Rates
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {multiplierTable.map((range, i) => {
              const isActive = current >= range.from && current <= range.to;
              return (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-center transition-colors ${
                    isActive
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-background/30 border border-border/20'
                  }`}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    Level {range.from}–{range.to}
                  </div>
                  <div className={`text-lg font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {range.multiplier}x
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function getMultiplierForDisplay(skill: number, category: SkillCategory): number {
  const table = category === 'magic' ? MAGIC_MULTIPLIERS : SKILL_MULTIPLIERS;
  for (const range of table) {
    if (skill >= range.from && skill <= range.to) {
      return range.multiplier;
    }
  }
  return table[table.length - 1].multiplier;
}
