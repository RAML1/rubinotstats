import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PremiumClient } from "./PremiumClient";

export const metadata: Metadata = {
  title: "Get Premium - RubinOT Stats",
  description: "Highlight your auctions, access advanced market analysis, and find underpriced deals.",
};

export default async function PremiumPage() {
  const t = await getTranslations('premium');

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground">
          {t('subheading')}
        </p>
      </div>
      <PremiumClient />
    </div>
  );
}
