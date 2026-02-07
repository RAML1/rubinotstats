"use client";

import {
  TrendingUp,
  TrendingDown,
  Coins,
  Shield,
  Swords,
  Users,
  Skull,
  Target,
  Sparkles,
  BookOpen,
  Clock,
  Zap,
  Hand,
  CircleDot,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  superBonkLee,
  superBonkLeeSnapshots,
  allMockAuctions,
} from "@/lib/mock-data";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Format large numbers with suffixes
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

// Generate sparkline data for stats
function generateSparklineData(
  baseValue: number,
  trend: "up" | "down" | "stable",
  points: number = 7
): { value: number }[] {
  const data: { value: number }[] = [];
  let current = baseValue * 0.85;
  const trendFactor = trend === "up" ? 1.03 : trend === "down" ? 0.97 : 1.0;

  for (let i = 0; i < points; i++) {
    const variance = (Math.random() - 0.5) * (baseValue * 0.02);
    current = current * trendFactor + variance;
    data.push({ value: Math.round(current) });
  }

  // Ensure last point is close to base value
  data[data.length - 1] = { value: baseValue };
  return data;
}

// Process experience chart data from snapshots
const experienceChartData = superBonkLeeSnapshots.map((snapshot, index) => {
  const date = new Date(snapshot.capturedDate);
  return {
    day: index + 1,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    experience: Number(snapshot.experience) / 1_000_000_000,
    expGained: Number(snapshot.expGained) / 1_000_000,
  };
});

// Character data
const characterStats = {
  name: superBonkLee.name,
  level: superBonkLee.level,
  vocation: superBonkLee.vocation,
  world: superBonkLee.world,
  guild: superBonkLee.guild || "None",
  experience: Number(superBonkLee.experience),
  weeklyExpGain: 236_000_000,
  magicLevel: 48,
  fistFighting: 128,
  clubFighting: 125,
  shielding: 115,
  deaths: 3,
  quests: 142,
};

// Auction data with "Good Deal" flags
const auctionData = [
  {
    id: 1,
    name: "Sensei Hiroshi",
    level: 450,
    vocation: "Exalted Monk",
    world: "Auroria",
    currentBid: 1250,
    timeRemaining: "6d 12h",
    magicLevel: 38,
    mainSkill: 118,
    mainSkillName: "Fist",
    isGoodDeal: true,
  },
  {
    id: 2,
    name: "Martial Master Yuki",
    level: 320,
    vocation: "Exalted Monk",
    world: "Elysian",
    currentBid: 580,
    timeRemaining: "1d 18h",
    magicLevel: 32,
    mainSkill: 108,
    mainSkillName: "Fist",
    isGoodDeal: false,
  },
  {
    id: 3,
    name: "Freya de Rivia",
    level: 415,
    vocation: "Elite Knight",
    world: "Elysian",
    currentBid: 590,
    timeRemaining: "2d 4h",
    magicLevel: 12,
    mainSkill: 118,
    mainSkillName: "Sword",
    isGoodDeal: true,
  },
  {
    id: 4,
    name: "Paumandado",
    level: 828,
    vocation: "Elite Knight",
    world: "Auroria",
    currentBid: 601,
    timeRemaining: "3d 8h",
    magicLevel: 15,
    mainSkill: 132,
    mainSkillName: "Sword",
    isGoodDeal: false,
  },
];

// Sparkline chart component
function Sparkline({
  data,
  color,
  height = 32,
}: {
  data: { value: number }[];
  color: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// KPI Stat Card with sparkline
function KPICard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
  sparklineColor,
  sparklineData,
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  icon: React.ElementType;
  sparklineColor: string;
  sparklineData: { value: number }[];
}) {
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="rounded-md p-1.5"
            style={{ backgroundColor: `${sparklineColor}15` }}
          >
            <Icon className="h-4 w-4" style={{ color: sparklineColor }} />
          </div>
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        {trend && trendValue && (
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-400"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-100">{value}</span>
        <div className="h-8 w-20">
          <Sparkline data={sparklineData} color={sparklineColor} />
        </div>
      </div>
    </div>
  );
}

// Stat mini card
function StatMiniCard({
  label,
  value,
  icon: Icon,
  iconColor,
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  trend?: "up" | "down";
  trendLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="rounded-md p-1.5"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        {trend && trendLabel && (
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend === "up" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

// Auction card component
function AuctionCard({
  auction,
}: {
  auction: (typeof auctionData)[0];
}) {
  return (
    <Card className="group relative overflow-hidden border-slate-800/50 bg-slate-900/40 backdrop-blur-sm transition-all hover:border-slate-700 hover:bg-slate-900/60">
      {auction.isGoodDeal && (
        <div className="absolute right-3 top-3">
          <Badge className="border-0 bg-emerald-500/20 text-emerald-400">
            Good Deal
          </Badge>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold ${
              auction.vocation.includes("Monk")
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {auction.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base text-slate-100 truncate pr-16">
              {auction.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-slate-400">
              <span>Level {auction.level}</span>
              <span className="text-slate-600">|</span>
              <span className="truncate">{auction.vocation}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Users className="h-3.5 w-3.5" />
          <span>{auction.world}</span>
        </div>

        {/* Skills preview */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-slate-400">ML</span>
            <span className="font-medium text-slate-200">
              {auction.magicLevel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-slate-400">{auction.mainSkillName}</span>
            <span className="font-medium text-slate-200">
              {auction.mainSkill}
            </span>
          </div>
        </div>

        {/* Bid and time */}
        <div className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3">
          <div>
            <p className="text-xs text-slate-500">Current Bid</p>
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-amber-400">
                {auction.currentBid.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Time Left</p>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-medium">{auction.timeRemaining}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom tooltip for area chart
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-emerald-400">
          +{payload[0].value.toFixed(1)}M exp
        </p>
      </div>
    );
  }
  return null;
}

export default function HomePage() {
  // Generate sparkline data for each stat
  const expSparkline = generateSparklineData(7786993479, "up");
  const mlSparkline = generateSparklineData(48, "stable", 7);
  const fistSparkline = generateSparklineData(128, "up");
  const clubSparkline = generateSparklineData(125, "up");
  const shieldSparkline = generateSparklineData(115, "stable");

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-[#0a0f1a] via-[#111827] to-[#0a0f1a]">
      {/* Hero Header */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-slate-100 via-slate-200 to-slate-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            RubinOT Stats
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            Character Progression Tracker & Auction Intelligence
          </p>
        </div>
      </section>

      {/* SECTION 1: Character Progress */}
      <section className="container mx-auto px-4 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2">
            <Target className="h-5 w-5 text-teal-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">
            Character Progress
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Character Card */}
          <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-sm lg:row-span-2">
            <CardContent className="p-6">
              {/* Character header */}
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl font-bold text-white shadow-lg shadow-amber-500/20">
                  S
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-slate-100">
                    {characterStats.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="border-0 bg-amber-500/20 text-amber-400">
                      Level {characterStats.level}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      {characterStats.vocation}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Character info grid */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-3">
                  <p className="text-xs text-slate-500">World</p>
                  <p className="font-semibold text-slate-200">
                    {characterStats.world}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-3">
                  <p className="text-xs text-slate-500">Guild</p>
                  <p className="font-semibold text-slate-200">
                    {characterStats.guild}
                  </p>
                </div>
              </div>

              {/* Total experience */}
              <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-slate-400">
                      Total Experience
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>+236M this week</span>
                  </div>
                </div>
                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {formatNumber(characterStats.experience)}
                </p>
              </div>

              {/* Additional stats */}
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-medium text-slate-400">
                  Additional Stats
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <StatMiniCard
                    label="Deaths"
                    value={characterStats.deaths}
                    icon={Skull}
                    iconColor="#ef4444"
                    trend="down"
                    trendLabel="Good!"
                  />
                  <StatMiniCard
                    label="Quests"
                    value={characterStats.quests}
                    icon={BookOpen}
                    iconColor="#8b5cf6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Stats Grid */}
          <div className="space-y-4 lg:col-span-2">
            <h4 className="text-sm font-medium text-slate-400">
              Combat Skills
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KPICard
                label="Experience"
                value={formatNumber(characterStats.experience)}
                trend="up"
                trendValue="+236M"
                icon={Zap}
                sparklineColor="#10b981"
                sparklineData={expSparkline}
              />
              <KPICard
                label="Magic Level"
                value={characterStats.magicLevel}
                trend="stable"
                trendValue="Slow"
                icon={Sparkles}
                sparklineColor="#8b5cf6"
                sparklineData={mlSparkline}
              />
              <KPICard
                label="Fist Fighting"
                value={characterStats.fistFighting}
                trend="up"
                trendValue="+2"
                icon={Hand}
                sparklineColor="#f59e0b"
                sparklineData={fistSparkline}
              />
              <KPICard
                label="Club Fighting"
                value={characterStats.clubFighting}
                trend="up"
                trendValue="+1"
                icon={CircleDot}
                sparklineColor="#3b82f6"
                sparklineData={clubSparkline}
              />
              <KPICard
                label="Shielding"
                value={characterStats.shielding}
                trend="stable"
                trendValue="Stable"
                icon={Shield}
                sparklineColor="#06b6d4"
                sparklineData={shieldSparkline}
              />
            </div>
          </div>

          {/* Experience Progression Chart */}
          <div className="lg:col-span-2">
            <Card className="border-slate-800/50 bg-slate-900/40 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-100">
                      Experience Progression
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Daily experience gains over the last 30 days
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-slate-400">Exp Gained (M)</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={experienceChartData}>
                      <defs>
                        <linearGradient
                          id="expGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10b981"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#10b981"
                            stopOpacity={0.05}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(value) => `${value.toFixed(0)}M`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="expGained"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#expGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 2: Auctions */}
      <section className="container mx-auto px-4 pb-24">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Coins className="h-5 w-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">
              Active Auctions
            </h2>
          </div>
          <Badge variant="outline" className="border-slate-700 text-slate-400">
            {auctionData.length} listings
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {auctionData.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      </section>
    </div>
  );
}
