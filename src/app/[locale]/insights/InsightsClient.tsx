"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Crown,
  Swords,
  Shield,
  Crosshair,
  Wand2,
  Users,
  Sparkles,
  ExternalLink,
  Globe,
  Gem,
  BarChart3,
  Target,
  Flame,
} from "lucide-react";
import { formatNumber, getVocationColor } from "@/lib/utils/formatters";

// ── Types ────────────────────────────────────────────────────────────
type PriceByVocation = {
  vocation: string;
  level_band: string;
  avg_price: number;
  median_price: number;
  count: number;
};

type SkillsByVocation = {
  vocation: string;
  avg_ml: number;
  avg_fist: number;
  avg_club: number;
  avg_sword: number;
  avg_axe: number;
  avg_distance: number;
  avg_shielding: number;
  avg_level: number;
  count: number;
};

type PriceTrend = {
  week: string;
  avg_price: number;
  median_price: number;
  volume: number;
};

type BestDeal = {
  characterName: string;
  externalId: string;
  level: number;
  vocation: string;
  currentBid: number;
  estimatedValue: number;
  discount: number;
};

type OverallStats = {
  total_sold: number;
  avg_price: number;
  median_price: number;
  total_current: number;
  total_expired: number;
  sell_rate: number;
  highest_sale: number;
};

type WorldStat = {
  world: string;
  sold: number;
  expired: number;
  sell_rate: number;
  avg_price: number;
  median_price: number;
};

type PriceDriver = {
  category: string;
  tier: string;
  avg_price: number;
  median_price: number;
  count: number;
};

type VocationMarketShare = {
  vocation: string;
  sold: number;
  expired: number;
  total: number;
  avg_price: number;
};

type PriceDistribution = {
  price_range: string;
  count: number;
  sort_order: number;
};

type SellRateByPrice = {
  bid_range: string;
  total: number;
  sold: number;
  sell_rate: number;
  sort_order: number;
};

type TopExpGainer = {
  character_name: string;
  world: string;
  vocation: string;
  current_level: number;
  exp_gained: number;
  levels_gained: number;
};

type InsightsData = {
  priceByVocation: PriceByVocation[];
  skillsByVocation: SkillsByVocation[];
  priceTrends: PriceTrend[];
  bestDeals: BestDeal[];
  overallStats: OverallStats;
  worldStats: WorldStat[];
  priceDrivers: PriceDriver[];
  vocationMarketShare: VocationMarketShare[];
  priceDistribution: PriceDistribution[];
  sellRateByPrice: SellRateByPrice[];
  topExpGainers: TopExpGainer[];
};

// ── Constants ────────────────────────────────────────────────────────
const VOCATION_COLORS: Record<string, string> = {
  "Elite Knight": "#ef4444",
  Knight: "#ef4444",
  "Master Sorcerer": "#3b82f6",
  Sorcerer: "#3b82f6",
  "Elder Druid": "#22c55e",
  Druid: "#22c55e",
  "Royal Paladin": "#eab308",
  Paladin: "#eab308",
  "Exalted Monk": "#a855f7",
  Monk: "#a855f7",
};

const PIE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];

function getVocIcon(voc: string) {
  if (voc.includes("Knight")) return Swords;
  if (voc.includes("Sorcerer")) return Wand2;
  if (voc.includes("Druid")) return Sparkles;
  if (voc.includes("Paladin")) return Crosshair;
  if (voc.includes("Monk")) return Shield;
  return Users;
}

const LEVEL_BAND_ORDER = ["8-99", "100-199", "200-299", "300-499", "500+"];

const GLASS_TOOLTIP = {
  contentStyle: {
    backgroundColor: "rgba(15, 15, 26, 0.92)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    padding: "10px 14px",
  },
  labelStyle: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 500 },
  itemStyle: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
};

const GRID_STYLE = { strokeDasharray: "3 6", stroke: "rgba(255,255,255,0.04)" };
const AXIS_TICK = { fill: "rgba(255,255,255,0.4)" };

// ── Section Component ────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, iconColor, children }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: iconColor || "currentColor" }} />
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">({subtitle})</span>}
      </div>
      {children}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export function InsightsClient() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.error || "Failed to load insights");
      })
      .catch(() => setError("Failed to load insights"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading market data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-red-400">{error || "Unknown error"}</p>
      </div>
    );
  }

  const vocations = [...new Set(data.priceByVocation.map((p) => p.vocation))];

  const barChartData = LEVEL_BAND_ORDER.map((band) => {
    const entry: Record<string, string | number> = { levelBand: band };
    for (const voc of vocations) {
      const match = data.priceByVocation.find(
        (p) => p.vocation === voc && p.level_band === band
      );
      if (match) entry[voc] = match.median_price;
    }
    return entry;
  });

  return (
    <div className="space-y-6">
      {/* ── Overall Stats ──────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Sold Auctions" value={formatNumber(data.overallStats.total_sold)} />
        <StatCard label="Average Price" value={`${formatNumber(data.overallStats.avg_price)} TC`} />
        <StatCard label="Median Price" value={`${formatNumber(data.overallStats.median_price)} TC`} />
        <StatCard label="Active Auctions" value={formatNumber(data.overallStats.total_current)} />
        <StatCard label="Expired" value={formatNumber(data.overallStats.total_expired)} />
        <StatCard label="Sell Rate" value={`${data.overallStats.sell_rate}%`} accent />
        <StatCard label="Highest Sale" value={`${formatNumber(data.overallStats.highest_sale)} TC`} accent />
      </div>

      {/* ── Best Deals ─────────────────────────────────────── */}
      <Section icon={TrendingDown} title="Best Deals Right Now" subtitle="Current auctions below estimated value" iconColor="#4ade80">
        {data.bestDeals.length > 0 ? (
          <div className="space-y-2">
            {data.bestDeals.map((deal) => {
              const color = VOCATION_COLORS[deal.vocation] || "#888";
              const Icon = getVocIcon(deal.vocation);
              return (
                <a
                  key={deal.externalId}
                  href={`https://rubinot.com.br/?currentcharactertrades/${deal.externalId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 hover:bg-accent/30 transition-colors group"
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{deal.characterName}</span>
                      <span className="text-xs text-muted-foreground">Lv. {deal.level}</span>
                      <span className="text-[10px] font-medium" style={{ color }}>{deal.vocation}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs">
                        Current: <span className="font-semibold" style={{ color: "#fbbf24" }}>{formatNumber(deal.currentBid)} TC</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Est. value: {formatNumber(deal.estimatedValue)} TC
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ backgroundColor: "#1a3a1a", color: "#4ade80", border: "1px solid #2a5a2a" }}
                    >
                      -{deal.discount}%
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No significant deals found right now</p>
        )}
      </Section>

      {/* ── Row: Price Trends + Vocation Market Share ──────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section icon={TrendingUp} title="Price Trends" subtitle="Weekly average & median" iconColor="#8b5cf6">
            {data.priceTrends.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.priceTrends}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#A78BFA" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="medianGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34D399" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                      </linearGradient>
                      <filter id="lineGlow" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid {...GRID_STYLE} vertical={false} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      tick={{ ...AXIS_TICK, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tickFormatter={(v: number) => formatNumber(v)} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      {...GLASS_TOOLTIP}
                      formatter={(value: number, name: string) => [
                        formatNumber(value) + " TC",
                        name === "avg_price" ? "Avg Price" : "Median Price",
                      ]}
                      labelFormatter={(label: string) => `Week of ${label}`}
                    />
                    <Area type="monotone" dataKey="avg_price" stroke="#A78BFA" fill="url(#priceGradient)" strokeWidth={2} name="avg_price" style={{ filter: "url(#lineGlow)" }} />
                    <Area type="monotone" dataKey="median_price" stroke="#34D399" fill="url(#medianGradient)" strokeWidth={1.5} strokeDasharray="4 2" name="median_price" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Not enough data yet</p>
            )}
          </Section>
        </div>

        <Section icon={Users} title="Market Share" subtitle="By vocation" iconColor="#eab308">
          {data.vocationMarketShare.length > 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <defs>
                    <filter id="pieGlow2" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <Pie
                    data={data.vocationMarketShare}
                    dataKey="sold"
                    nameKey="vocation"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                    style={{ filter: "url(#pieGlow2)" }}
                  >
                    {data.vocationMarketShare.map((entry, idx) => (
                      <Cell key={entry.vocation} fill={VOCATION_COLORS[entry.vocation] || PIE_COLORS[idx % PIE_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...GLASS_TOOLTIP}
                    formatter={(value: number, name: string) => [
                      `${formatNumber(value)} sold`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {data.vocationMarketShare.map((v) => (
                  <div key={v.vocation} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: VOCATION_COLORS[v.vocation] || "#888" }} />
                    <span className="text-[10px] text-muted-foreground">{v.vocation.replace("Elite ", "").replace("Master ", "").replace("Elder ", "").replace("Royal ", "").replace("Exalted ", "")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>
      </div>

      {/* ── Row: Price Distribution + Sell Rate by Min Bid ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={BarChart3} title="Price Distribution" subtitle="Sold auctions" iconColor="#60a5fa">
          {data.priceDistribution.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.priceDistribution}>
                  <defs>
                    <linearGradient id="priceDistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_STYLE} vertical={false} />
                  <XAxis dataKey="price_range" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => formatNumber(v)} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...GLASS_TOOLTIP} formatter={(value: number) => [formatNumber(value), "Auctions"]} />
                  <Bar dataKey="count" fill="url(#priceDistGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>

        <Section icon={Target} title="Sell Rate by Starting Price" subtitle="What price range gets you a sale?" iconColor="#4ade80">
          {data.sellRateByPrice.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sellRateByPrice}>
                  <defs>
                    <linearGradient id="sellRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0.15} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_STYLE} vertical={false} />
                  <XAxis dataKey="bid_range" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    {...GLASS_TOOLTIP}
                    formatter={(value: number, name: string) => {
                      if (name === "sell_rate") return [`${value}%`, "Sell Rate"];
                      return [formatNumber(value), name === "sold" ? "Sold" : "Total"];
                    }}
                  />
                  <Bar dataKey="sell_rate" fill="url(#sellRateGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>
      </div>

      {/* ── Median Price by Vocation & Level ───────────────── */}
      <Section icon={Crown} title="Median Price by Vocation & Level" iconColor="#fbbf24">
        {barChartData.length > 0 ? (
          <>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <defs>
                    {vocations.map((voc) => {
                      const color = VOCATION_COLORS[voc] || "#888";
                      return (
                        <linearGradient key={`vg-${voc}`} id={`vocGrad-${voc.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.85} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.2} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid {...GRID_STYLE} vertical={false} />
                  <XAxis dataKey="levelBand" tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => formatNumber(v)} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...GLASS_TOOLTIP}
                    formatter={(value: number, name: string) => [formatNumber(value) + " TC", name]}
                  />
                  {vocations.map((voc) => (
                    <Bar key={voc} dataKey={voc} fill={`url(#vocGrad-${voc.replace(/\s/g, "")})`} radius={[6, 6, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {vocations.map((voc) => (
                <div key={voc} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: VOCATION_COLORS[voc] || "#888" }} />
                  <span className="text-xs text-muted-foreground">{voc}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Not enough data yet</p>
        )}
      </Section>

      {/* ── Row: Price Drivers + World Stats ───────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Gem} title="Price Drivers" subtitle="What increases auction value?" iconColor="#f472b6">
          {data.priceDrivers.length > 0 ? (
            <div className="space-y-4">
              {["Charm Points", "Boss Points", "Quest Access"].map((category) => {
                const items = data.priceDrivers.filter((d) => d.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                    <div className="space-y-1.5">
                      {items.map((item) => {
                        const maxPrice = Math.max(...items.map((i) => i.avg_price));
                        const width = maxPrice > 0 ? (item.avg_price / maxPrice) * 100 : 0;
                        return (
                          <div key={item.tier} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-24 shrink-0 text-right">{item.tier}</span>
                            <div className="flex-1 h-6 rounded bg-border/30 relative overflow-hidden">
                              <div
                                className="h-full rounded transition-all"
                                style={{
                                  width: `${width}%`,
                                  background: `linear-gradient(90deg, #d97706 0%, #f59e0b 100%)`,
                                  opacity: 0.7 + (width / 100) * 0.3,
                                }}
                              />
                              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white">
                                {formatNumber(item.avg_price)} TC avg
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 w-12 text-right">{item.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>

        <Section icon={Globe} title="World Market" subtitle="Price & sell rate by world" iconColor="#38bdf8">
          {data.worldStats.length > 0 ? (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-2 text-xs font-semibold text-muted-foreground">World</th>
                    <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-right">Avg Price</th>
                    <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-right">Median</th>
                    <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-right">Sell Rate</th>
                    <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-right">Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.worldStats.map((w) => (
                    <tr key={w.world} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                      <td className="py-2 px-2 font-medium text-xs">{w.world}</td>
                      <td className="py-2 px-2 text-right text-xs font-semibold" style={{ color: "#fbbf24" }}>{formatNumber(w.avg_price)}</td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground">{formatNumber(w.median_price)}</td>
                      <td className="py-2 px-2 text-right">
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: w.sell_rate >= 60 ? "#1a3a1a" : w.sell_rate >= 50 ? "#2a2a1a" : "#3a1a1a",
                            color: w.sell_rate >= 60 ? "#4ade80" : w.sell_rate >= 50 ? "#fbbf24" : "#f87171",
                          }}
                        >
                          {w.sell_rate}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground">{formatNumber(w.sold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>
      </div>

      {/* ── Row: Skills by Vocation + Top EXP Gainers ──────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Sparkles} title="Average Skills by Vocation" subtitle="Sold characters" iconColor="#22d3ee">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground">Vocation</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Lvl</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">ML</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Sword</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Axe</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Club</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Dist</th>
                  <th className="py-2 px-2 text-xs font-semibold text-muted-foreground text-center">Shld</th>
                </tr>
              </thead>
              <tbody>
                {data.skillsByVocation.map((row) => {
                  const Icon = getVocIcon(row.vocation);
                  const color = VOCATION_COLORS[row.vocation] || "#888";
                  return (
                    <tr key={row.vocation} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                          <span className="text-xs font-medium" style={{ color }}>{row.vocation}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_level}</td>
                      <td className="py-2 px-2 text-center text-xs font-semibold" style={{ color: "#60a5fa" }}>{row.avg_ml}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_sword}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_axe}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_club}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_distance}</td>
                      <td className="py-2 px-2 text-center text-xs">{row.avg_shielding}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={Flame} title="Top EXP Gainers" subtitle="Last 7 days" iconColor="#f97316">
          {data.topExpGainers.length > 0 ? (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {data.topExpGainers.map((g, idx) => {
                const Icon = getVocIcon(g.vocation);
                const color = VOCATION_COLORS[g.vocation] || "#888";
                return (
                  <div key={g.character_name} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/20 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground/50 w-5 text-right">{idx + 1}</span>
                    <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{g.character_name}</span>
                        <span className="text-[10px] text-muted-foreground">{g.world}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>Lv. {g.current_level}</span>
                        {g.levels_gained > 0 && (
                          <span className="text-emerald-400">+{g.levels_gained} lvls</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold" style={{ color: "#f97316" }}>
                        {formatNumber(g.exp_gained)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">EXP gained</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Not enough data</p>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${accent ? "text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}
