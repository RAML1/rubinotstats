"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
} from "lucide-react";
import { formatNumber, getVocationColor } from "@/lib/utils/formatters";

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
  count: number;
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
  total_current: number;
};

type InsightsData = {
  priceByVocation: PriceByVocation[];
  skillsByVocation: SkillsByVocation[];
  priceTrends: PriceTrend[];
  bestDeals: BestDeal[];
  overallStats: OverallStats;
};

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

function getVocIcon(voc: string) {
  if (voc.includes("Knight")) return Swords;
  if (voc.includes("Sorcerer")) return Wand2;
  if (voc.includes("Druid")) return Sparkles;
  if (voc.includes("Paladin")) return Crosshair;
  if (voc.includes("Monk")) return Shield;
  return Users;
}

const LEVEL_BAND_ORDER = ["8-99", "100-199", "200-299", "300-499", "500+"];

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

  // Group price data by vocation for the chart
  const vocations = [...new Set(data.priceByVocation.map((p) => p.vocation))];

  // Prepare bar chart data: each level band has avg_price for each vocation
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
    <div className="space-y-8">
      {/* Overall Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sold Auctions</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(data.overallStats.total_sold)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Average Sold Price</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(data.overallStats.avg_price)} TC</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Auctions</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(data.overallStats.total_current)}</p>
        </div>
      </div>

      {/* Price Trends Chart */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Price Trends</h2>
          <span className="text-xs text-muted-foreground">(Weekly average)</span>
        </div>
        {data.priceTrends.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.priceTrends}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  stroke="#666"
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(v: number) => formatNumber(v)}
                  stroke="#666"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }}
                  labelStyle={{ color: "#999" }}
                  formatter={(value: number) => [formatNumber(value) + " TC", "Avg Price"]}
                  labelFormatter={(label: string) => `Week of ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="avg_price"
                  stroke="#8b5cf6"
                  fill="url(#priceGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">Not enough data yet</p>
        )}
      </div>

      {/* Median Price by Vocation & Level */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold">Median Price by Vocation & Level</h2>
        </div>
        {barChartData.length > 0 ? (
          <>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="levelBand" stroke="#666" fontSize={11} />
                  <YAxis tickFormatter={(v: number) => formatNumber(v)} stroke="#666" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }}
                    labelStyle={{ color: "#999" }}
                    formatter={(value: number, name: string) => [formatNumber(value) + " TC", name]}
                  />
                  {vocations.map((voc) => (
                    <Bar
                      key={voc}
                      dataKey={voc}
                      fill={VOCATION_COLORS[voc] || "#888"}
                      radius={[2, 2, 0, 0]}
                      opacity={0.8}
                    />
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
      </div>

      {/* Average Skills by Vocation */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold">Average Skills by Vocation</h2>
          <span className="text-xs text-muted-foreground">(Sold characters)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground">Vocation</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Avg Level</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Magic Level</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Sword</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Axe</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Club</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Distance</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Shielding</th>
                <th className="py-2 px-3 text-xs font-semibold text-muted-foreground text-center">Sales</th>
              </tr>
            </thead>
            <tbody>
              {data.skillsByVocation.map((row) => {
                const Icon = getVocIcon(row.vocation);
                const color = VOCATION_COLORS[row.vocation] || "#888";
                return (
                  <tr key={row.vocation} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                        <span className="font-medium" style={{ color }}>{row.vocation}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">{row.avg_level}</td>
                    <td className="py-2.5 px-3 text-center font-semibold" style={{ color: "#60a5fa" }}>{row.avg_ml}</td>
                    <td className="py-2.5 px-3 text-center">{row.avg_sword}</td>
                    <td className="py-2.5 px-3 text-center">{row.avg_axe}</td>
                    <td className="py-2.5 px-3 text-center">{row.avg_club}</td>
                    <td className="py-2.5 px-3 text-center">{row.avg_distance}</td>
                    <td className="py-2.5 px-3 text-center">{row.avg_shielding}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{row.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Best Deals */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" style={{ color: "#4ade80" }} />
          <h2 className="text-lg font-semibold">Best Deals Right Now</h2>
          <span className="text-xs text-muted-foreground">(Current auctions below estimated value)</span>
        </div>
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
      </div>
    </div>
  );
}
