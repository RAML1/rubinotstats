import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { ContactWidget } from "@/components/contact/ContactWidget";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
      <AnalyticsTracker />
      <FeedbackWidget />
      <ContactWidget />
    </NextIntlClientProvider>
  );
}
