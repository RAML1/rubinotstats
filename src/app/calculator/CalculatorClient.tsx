'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Calculator, Swords, Target, Clock, Zap, Shield, Crown, Coins, Info } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import {
  calculateWeaponsNeeded,
  calculateSkillGain,
  getMultiplierForDisplay,
  getVocationConstant,
  SKILL_CATEGORIES,
  VOCATIONS,
  WEAPON_TYPES,
  SKILL_MULTIPLIERS,
  MAGIC_MULTIPLIERS,
  type Vocation,
  type SkillCategory,
  type CalculatorModifiers,
  type WeaponsNeededResult,
  type SkillGainResult,
} from '@/lib/utils/skill-calculator';

type Mode = 'target' | 'weapons';

const LOYALTY_OPTIONS = Array.from({ length: 11 }, (_, i) => i * 5);

// --- Draggable Percentage Slider ---

function PercentSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = Math.round((x / rect.width) * 10000) / 100; // 2 decimal places
      onChange(Math.max(0, Math.min(99.99, pct)));
    },
    [onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateFromPosition(e.clientX);
    },
    [updateFromPosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      updateFromPosition(e.clientX);
    },
    [updateFromPosition],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const fillPct = Math.min(100, Math.max(0, value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">% to Next Level</label>
        <span className="text-sm font-bold tabular-nums text-primary">{value.toFixed(2)}%</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-6 cursor-pointer select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 rounded-full bg-background border border-border/50" />
        {/* Filled portion */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-full bg-primary/60"
          style={{ width: `${fillPct}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-primary-foreground shadow-md transition-shadow hover:shadow-lg"
          style={{ left: `calc(${fillPct}% - 8px)` }}
        />
        {/* Tick marks */}
        <div className="absolute top-full mt-0.5 left-0 right-0 flex justify-between px-0.5">
          {[0, 25, 50, 75, 100].map((tick) => (
            <span key={tick} className="text-[8px] text-muted-foreground/50 tabular-nums">{tick}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Vocation Speed Indicator ---

function VocationSpeedHint({ vocation, category }: { vocation: Vocation; category: SkillCategory }) {
  const b = getVocationConstant(vocation, category);
  let speed: string;
  let color: string;
  if (b <= 1.1) {
    speed = 'Primary skill — fastest training';
    color = 'text-emerald-400';
  } else if (b <= 1.2) {
    speed = 'Secondary skill — fast training';
    color = 'text-green-400';
  } else if (b <= 1.5) {
    speed = 'Moderate training speed';
    color = 'text-yellow-400';
  } else if (b <= 2.0) {
    speed = 'Slow training speed';
    color = 'text-orange-400';
  } else {
    speed = 'Very slow training speed';
    color = 'text-red-400';
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <Info className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      <span className={`text-xs ${color}`}>{speed}</span>
      <span className="text-[10px] text-muted-foreground/50">(b={b})</span>
    </div>
  );
}

export default function CalculatorClient() {
  // Mode
  const [mode, setMode] = useState<Mode>('target');

  // Shared inputs
  const [vocation, setVocation] = useState<Vocation>('knight');
  const [category, setCategory] = useState<SkillCategory>('sword');
  const [currentSkill, setCurrentSkill] = useState<string>('10');
  const [percentToNext, setPercentToNext] = useState<number>(0);
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
  const target = parseInt(targetSkill, 10) || 0;
  const count = parseInt(weaponCount, 10) || 0;

  // Auto-select a sensible default skill when vocation changes
  const handleVocationChange = (v: Vocation) => {
    setVocation(v);
    // Set to the primary skill for the vocation
    switch (v) {
      case 'knight': setCategory('sword'); break;
      case 'paladin': setCategory('distance'); break;
      case 'sorcerer': case 'druid': setCategory('magic'); break;
    }
  };

  // Mode 1 result
  const weaponsResult: WeaponsNeededResult | null = useMemo(() => {
    if (mode !== 'target' || current <= 0 || target <= current) return null;
    return calculateWeaponsNeeded(category, vocation, current, percentToNext, target, modifiers);
  }, [mode, category, vocation, current, percentToNext, target, modifiers.loyaltyPercent, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

  // Mode 2 result
  const skillResult: SkillGainResult | null = useMemo(() => {
    if (mode !== 'weapons' || current <= 0 || count <= 0) return null;
    return calculateSkillGain(category, vocation, weaponType, count, current, percentToNext, modifiers);
  }, [mode, category, vocation, weaponType, count, current, percentToNext, modifiers.loyaltyPercent, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

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
            {/* Vocation + Skill */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Vocation</label>
                <select
                  value={vocation}
                  onChange={(e) => handleVocationChange(e.target.value as Vocation)}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {VOCATIONS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Skill</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SkillCategory)}
                  className="w-full px-3 py-2 bg-background border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {SKILL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <VocationSpeedHint vocation={vocation} category={category} />

            {/* Current Skill + Slider */}
            <div className="space-y-4">
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
              <PercentSlider value={percentToNext} onChange={setPercentToNext} />
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
                        {w.name} ({formatNumber(w.charges)} charges · {w.rcCost} RC)
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
                  {weaponsResult.weapons.map((w, i) => (
                    <div
                      key={w.name}
                      className="flex justify-between items-center p-3 bg-background/30 rounded-lg"
                    >
                      <span className="text-sm font-medium">{w.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-primary">
                          {formatNumber(w.count)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Coins className="w-3 h-3" />
                          {formatNumber(w.count * WEAPON_TYPES[i].rcCost)} RC
                        </span>
                      </div>
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
                    <span>Vocation</span>
                    <span>{VOCATIONS.find(v => v.value === vocation)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>From</span>
                    <span>Skill {current} ({percentToNext.toFixed(2)}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>To</span>
                    <span>Skill {target}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server multiplier</span>
                    <span>{getMultiplierForDisplay(current, category)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vocation rate</span>
                    <span>b={getVocationConstant(vocation, category)}</span>
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

                {/* RC Cost */}
                <div className="bg-background/50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                    Total Cost
                  </div>
                  <div className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    {formatNumber(count * WEAPON_TYPES[weaponType].rcCost)} RC
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-border/30 pt-4 text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Vocation</span>
                    <span>{VOCATIONS.find(v => v.value === vocation)?.label}</span>
                  </div>
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
                    <span>Price per weapon</span>
                    <span>{WEAPON_TYPES[weaponType].rcCost} RC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server multiplier</span>
                    <span>{getMultiplierForDisplay(current, category)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vocation rate</span>
                    <span>b={getVocationConstant(vocation, category)}</span>
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
            RubinOT {SKILL_CATEGORIES.find(c => c.value === category)?.label} Multiplier Rates
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
