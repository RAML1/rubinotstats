'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Target, Swords, Clock, Zap, Shield, Crown, Coins, ChevronDown } from 'lucide-react';
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

const VOCATION_COLORS: Record<Vocation, string> = {
  knight: 'hsl(0 84% 60%)',
  paladin: 'hsl(38 92% 50%)',
  sorcerer: 'hsl(258 90% 66%)',
  druid: 'hsl(160 84% 39%)',
  monk: 'hsl(30 80% 55%)',
};

const VOCATION_BG: Record<Vocation, string> = {
  knight: 'bg-red-500/10 border-red-500/20',
  paladin: 'bg-amber-500/10 border-amber-500/20',
  sorcerer: 'bg-purple-500/10 border-purple-500/20',
  druid: 'bg-emerald-500/10 border-emerald-500/20',
  monk: 'bg-orange-500/10 border-orange-500/20',
};

// --- Vocation Speed Indicator ---

function VocationSpeedHint({ vocation, category }: { vocation: Vocation; category: SkillCategory }) {
  const b = getVocationConstant(vocation, category);
  let speed: string;
  let dotColor: string;
  if (b <= 1.1) {
    speed = 'Primary skill — fastest training';
    dotColor = 'bg-emerald-400';
  } else if (b <= 1.2) {
    speed = 'Secondary skill — fast training';
    dotColor = 'bg-green-400';
  } else if (b <= 1.5) {
    speed = 'Moderate training speed';
    dotColor = 'bg-yellow-400';
  } else if (b <= 2.0) {
    speed = 'Slow training speed';
    dotColor = 'bg-orange-400';
  } else {
    speed = 'Very slow training speed';
    dotColor = 'bg-red-400';
  }

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background/40 border border-border/20">
      <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
      <span className="text-sm text-foreground/70">{speed}</span>
      <span className="text-xs text-muted-foreground/50 ml-auto">(b={b})</span>
    </div>
  );
}

// --- Select Component ---

function StyledSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none px-4 py-3 bg-[#252333] border border-[#4a4857] rounded-lg text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 cursor-pointer"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// --- Number Input ---

function StyledInput({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-background/60 border border-border/40 rounded-lg text-base font-medium text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
      />
    </div>
  );
}

// --- Time Formatter ---

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h} hours`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h > 0 ? `${d} days ${h}h` : `${d} days`;
}

export default function CalculatorClient() {
  const [mode, setMode] = useState<Mode>('target');
  const [vocation, setVocation] = useState<Vocation>('knight');
  const [category, setCategory] = useState<SkillCategory>('sword');
  const [currentSkill, setCurrentSkill] = useState<string>('10');
  const [percentToGo, setPercentToGo] = useState<string>('100');
  const [privateDummy, setPrivateDummy] = useState(false);
  const [doubleEvent, setDoubleEvent] = useState(false);
  const [vip, setVip] = useState(false);
  const [targetSkill, setTargetSkill] = useState<string>('100');
  const [weaponType, setWeaponType] = useState<number>(0);
  const [weaponCount, setWeaponCount] = useState<string>('1');

  const modifiers: CalculatorModifiers = { privateDummy, doubleEvent, vip };
  const current = parseInt(currentSkill, 10) || 0;
  const target = parseInt(targetSkill, 10) || 0;
  const count = parseInt(weaponCount, 10) || 0;
  const pctToGo = Math.max(0, Math.min(100, parseFloat(percentToGo) || 0));

  const handleVocationChange = (v: Vocation) => {
    setVocation(v);
    switch (v) {
      case 'knight': setCategory('sword'); break;
      case 'paladin': setCategory('distance'); break;
      case 'sorcerer': case 'druid': setCategory('magic'); break;
      case 'monk': setCategory('fist'); break;
    }
  };

  const weaponsResult: WeaponsNeededResult | null = useMemo(() => {
    if (mode !== 'target' || current <= 0 || target <= current) return null;
    return calculateWeaponsNeeded(category, vocation, current, pctToGo, target, modifiers);
  }, [mode, category, vocation, current, pctToGo, target, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

  const skillResult: SkillGainResult | null = useMemo(() => {
    if (mode !== 'weapons' || current <= 0 || count <= 0) return null;
    return calculateSkillGain(category, vocation, weaponType, count, current, pctToGo, modifiers);
  }, [mode, category, vocation, weaponType, count, current, pctToGo, modifiers.doubleEvent, modifiers.privateDummy, modifiers.vip]);

  const multiplierTable = category === 'magic' ? MAGIC_MULTIPLIERS : SKILL_MULTIPLIERS;
  const vocColor = VOCATION_COLORS[vocation];

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('target')}
          className={`relative py-4 px-5 rounded-xl font-semibold text-base transition-all ${
            mode === 'target'
              ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 text-foreground shadow-lg shadow-primary/10'
              : 'bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50'
          }`}
        >
          <Target className="w-5 h-5 inline-block mr-2 -mt-0.5" />
          Weapons Needed
          {mode === 'target' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setMode('weapons')}
          className={`relative py-4 px-5 rounded-xl font-semibold text-base transition-all ${
            mode === 'weapons'
              ? 'bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 text-foreground shadow-lg shadow-primary/10'
              : 'bg-card/30 border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50'
          }`}
        >
          <Swords className="w-5 h-5 inline-block mr-2 -mt-0.5" />
          Skill Gain
          {mode === 'weapons' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Input Card */}
        <Card className="border-border/30 bg-card/40 backdrop-blur lg:col-span-3 overflow-hidden">
          {/* Colored top accent bar */}
          <div className="h-1" style={{ backgroundColor: vocColor }} />

          <div className="p-6 space-y-6">
            {/* Vocation + Skill row */}
            <div className="grid grid-cols-2 gap-4">
              <StyledSelect
                label="Vocation"
                value={vocation}
                onChange={(e) => handleVocationChange(e.target.value as Vocation)}
              >
                {VOCATIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </StyledSelect>
              <StyledSelect
                label="Skill"
                value={category}
                onChange={(e) => setCategory(e.target.value as SkillCategory)}
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </StyledSelect>
            </div>

            <VocationSpeedHint vocation={vocation} category={category} />

            {/* Current Skill + % to go */}
            <div className="grid grid-cols-2 gap-4">
              <StyledInput
                label="Current Skill Level"
                value={currentSkill}
                onChange={(e) => setCurrentSkill(e.target.value)}
                placeholder="10"
                min={0}
                max={300}
              />
              <StyledInput
                label="% to Go"
                value={percentToGo}
                onChange={(e) => setPercentToGo(e.target.value)}
                placeholder="100"
                min={0}
                max={100}
                step="0.01"
              />
            </div>

            {/* Mode-specific inputs */}
            {mode === 'target' ? (
              <StyledInput
                label="Target Skill Level"
                value={targetSkill}
                onChange={(e) => setTargetSkill(e.target.value)}
                placeholder="100"
                min={(current || 0) + 1}
                max={300}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <StyledSelect
                  label="Weapon Type"
                  value={weaponType}
                  onChange={(e) => setWeaponType(Number(e.target.value))}
                >
                  {WEAPON_TYPES.map((w, i) => (
                    <option key={w.name} value={i}>
                      {w.name} ({formatNumber(w.charges)} ch{w.rcCost > 0 ? ` · ${w.rcCost} RC` : ' · Free'})
                    </option>
                  ))}
                </StyledSelect>
                <StyledInput
                  label="Number of Weapons"
                  value={weaponCount}
                  onChange={(e) => setWeaponCount(e.target.value)}
                  placeholder="1"
                  min={1}
                />
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border/20" />

            {/* Modifiers */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Time Modifiers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { checked: privateDummy, set: setPrivateDummy, icon: <Shield className="w-4 h-4 text-blue-400" />, label: 'Private Dummy', desc: '10% faster training' },
                  { checked: doubleEvent, set: setDoubleEvent, icon: <Zap className="w-4 h-4 text-yellow-400" />, label: 'Double Event', desc: '2x faster training' },
                  { checked: vip, set: setVip, icon: <Crown className="w-4 h-4 text-amber-400" />, label: 'VIP Account', desc: '10% faster training' },
                ].map((mod) => (
                  <label
                    key={mod.label}
                    className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                      mod.checked
                        ? 'bg-primary/8 border-primary/30'
                        : 'bg-background/30 border-border/20 hover:border-border/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={mod.checked}
                      onChange={(e) => mod.set(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        {mod.icon}
                        {mod.label}
                      </div>
                      <div className="text-xs text-muted-foreground/60">{mod.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Results Card */}
        <Card className="border-border/30 bg-card/40 backdrop-blur lg:col-span-2 overflow-hidden">
          {/* Colored top accent bar */}
          <div className="h-1" style={{ backgroundColor: vocColor }} />

          <div className="p-6">
            {mode === 'target' && weaponsResult && (
              <div className="space-y-5">
                {/* Hero stat: Total Charges */}
                <div
                  className={`rounded-xl p-5 border ${VOCATION_BG[vocation]}`}
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    Total Charges Needed
                  </div>
                  <div className="text-4xl font-extrabold tabular-nums" style={{ color: vocColor }}>
                    {formatNumber(weaponsResult.totalCharges)}
                  </div>
                </div>

                {/* Weapons Breakdown */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">
                    Weapons Required
                  </div>
                  {weaponsResult.weapons.map((w, i) => {
                    const rcTotal = w.count * WEAPON_TYPES[i].rcCost;
                    return (
                      <div
                        key={w.name}
                        className="flex items-center justify-between p-3.5 bg-background/30 rounded-lg border border-border/15 hover:border-border/30 transition-colors"
                      >
                        <div>
                          <div className="text-base font-semibold">{w.name}</div>
                          <div className="text-xs text-muted-foreground/50">
                            {formatNumber(WEAPON_TYPES[i].charges)} charges each
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold tabular-nums" style={{ color: vocColor }}>
                            {formatNumber(w.count)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-amber-400/80 justify-end">
                            <Coins className="w-3 h-3" />
                            {formatNumber(rcTotal)} RC
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Estimated Time */}
                <div className="flex items-center gap-3 p-3.5 bg-background/30 rounded-lg border border-border/15">
                  <Clock className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground/50 uppercase tracking-wide font-semibold">Estimated Time</div>
                    <div className="text-lg font-bold">
                      {formatTime(weaponsResult.estimatedSeconds)}
                    </div>
                  </div>
                </div>

                {/* Summary footer */}
                <div className="border-t border-border/15 pt-4 space-y-1.5">
                  {[
                    ['Vocation', VOCATIONS.find(v => v.value === vocation)?.label],
                    ['From', `Skill ${current} (${pctToGo.toFixed(2)}% to go)`],
                    ['To', `Skill ${target}`],
                    ['Server multiplier', `${getMultiplierForDisplay(current, category)}x`],
                    ['Vocation rate', `b=${getVocationConstant(vocation, category)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground/50">{k}</span>
                      <span className="font-medium text-foreground/80">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'weapons' && skillResult && (
              <div className="space-y-5">
                {/* Hero stat: Final Skill */}
                <div
                  className={`rounded-xl p-5 border ${VOCATION_BG[vocation]}`}
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    Final Skill Level
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold tabular-nums" style={{ color: vocColor }}>
                      {skillResult.finalSkill}
                    </span>
                    <span className="text-xl font-semibold text-muted-foreground">
                      ({skillResult.finalPercent.toFixed(2)}% to go)
                    </span>
                  </div>
                </div>

                {/* Levels Gained */}
                <div className="rounded-xl p-5 bg-emerald-500/8 border border-emerald-500/20">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    Levels Gained
                  </div>
                  <div className="text-4xl font-extrabold text-emerald-400 tabular-nums">
                    +{skillResult.levelsGained}
                  </div>
                </div>

                {/* RC Cost */}
                <div className="rounded-xl p-5 bg-amber-500/8 border border-amber-500/20">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
                    Total Cost
                  </div>
                  <div className="text-3xl font-extrabold text-amber-400 flex items-center gap-2.5 tabular-nums">
                    <Coins className="w-6 h-6" />
                    {formatNumber(count * WEAPON_TYPES[weaponType].rcCost)} RC
                  </div>
                </div>

                {/* Summary footer */}
                <div className="border-t border-border/15 pt-4 space-y-1.5">
                  {[
                    ['Vocation', VOCATIONS.find(v => v.value === vocation)?.label],
                    ['Weapon', `${count}x ${WEAPON_TYPES[weaponType].name}`],
                    ['Total charges', formatNumber(WEAPON_TYPES[weaponType].charges * count)],
                    ['Price per weapon', `${WEAPON_TYPES[weaponType].rcCost} RC`],
                    ['Server multiplier', `${getMultiplierForDisplay(current, category)}x`],
                    ['Vocation rate', `b=${getVocationConstant(vocation, category)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted-foreground/50">{k}</span>
                      <span className="font-medium text-foreground/80">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No result state */}
            {((mode === 'target' && !weaponsResult) || (mode === 'weapons' && !skillResult)) && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                  {mode === 'target' ? (
                    <Target className="w-7 h-7 text-primary/30" />
                  ) : (
                    <Swords className="w-7 h-7 text-primary/30" />
                  )}
                </div>
                <p className="text-base text-muted-foreground/50 max-w-[200px] mx-auto">
                  {mode === 'target'
                    ? 'Enter your current skill and target to calculate.'
                    : 'Enter your current skill and weapons to calculate.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Multiplier Reference Table */}
      <Card className="border-border/30 bg-card/40 backdrop-blur overflow-hidden">
        <div className="h-1" style={{ backgroundColor: vocColor }} />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5" style={{ color: vocColor }} />
            <h2 className="text-base font-bold">
              RubinOT {SKILL_CATEGORIES.find(c => c.value === category)?.label} Multiplier Rates
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {multiplierTable.map((range, i) => {
              const isActive = current >= range.from && current <= range.to;
              return (
                <div
                  key={i}
                  className={`p-4 rounded-xl text-center transition-all ${
                    isActive
                      ? `border-2 shadow-lg`
                      : 'bg-background/20 border border-border/15'
                  }`}
                  style={isActive ? {
                    backgroundColor: `color-mix(in srgb, ${vocColor} 12%, transparent)`,
                    borderColor: `color-mix(in srgb, ${vocColor} 35%, transparent)`,
                    boxShadow: `0 4px 20px color-mix(in srgb, ${vocColor} 15%, transparent)`,
                  } : undefined}
                >
                  <div className="text-xs text-muted-foreground/50 mb-1 font-medium">
                    Level {range.from}–{range.to}
                  </div>
                  <div
                    className="text-2xl font-extrabold tabular-nums"
                    style={isActive ? { color: vocColor } : undefined}
                  >
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
