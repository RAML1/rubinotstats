import type { Metadata } from "next";
import { PremiumClient } from "./PremiumClient";

export const metadata: Metadata = {
  title: "Get Premium - RubinOT Stats",
  description: "Highlight your auctions, access advanced market analysis, and find underpriced deals.",
};

export default function PremiumPage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Get Premium</h1>
        <p className="text-muted-foreground">
          Highlight your auctions, access advanced market analysis, and find underpriced deals before anyone else.
        </p>
      </div>
      <PremiumClient />
    </div>
  );
}
