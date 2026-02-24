import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Crown } from "lucide-react";
import { InsightsClient } from "./InsightsClient";
import { getSession } from "@/lib/auth-helpers";
import { isPremium } from "@/lib/utils/premium";

export const metadata: Metadata = {
  title: "Premium Dashboard - RubinOT Stats",
  description: "Premium market analytics, price drivers, world stats, and best deals for RubinOT character auctions",
};

export default async function InsightsPage() {
  const session = await getSession();
  const userIsPremium = session?.user && isPremium({ premiumTier: session.user.premiumTier, premiumUntil: session.user.premiumUntil });

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div>
        <div className="flex items-center gap-2">
          <Crown className="h-7 w-7" style={{ color: "#d4a44a" }} />
          <h1 className="text-3xl font-bold">Premium Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Market analytics, price drivers, world stats, and real-time best deals</p>
      </div>

      {userIsPremium ? (
        <InsightsClient />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full p-4" style={{ backgroundColor: "#2a2a1a", border: "1px solid #4a4a2a" }}>
            <Lock className="h-8 w-8" style={{ color: "#d4a44a" }} />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Premium Feature</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Market Insights includes price trends, vocation analytics, skill averages, and the best deals on current auctions.
            </p>
          </div>
          <Link
            href="/premium"
            className="mt-2 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#d4a44a", color: "#1a1a1a" }}
          >
            <Crown className="h-4 w-4" />
            Unlock Premium
          </Link>
        </div>
      )}
    </div>
  );
}
