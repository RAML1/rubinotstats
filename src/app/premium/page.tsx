import type { Metadata } from "next";
import { PremiumClient } from "./PremiumClient";

export const metadata: Metadata = {
  title: "Get Premium - RubinOT Stats",
  description: "Unlock market insights, featured auctions, and more.",
};

export default function PremiumPage() {
  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Get Premium</h1>
        <p className="text-muted-foreground">
          Unlock powerful tools to find the best deals on the character bazaar.
        </p>
      </div>
      <PremiumClient />
    </div>
  );
}
