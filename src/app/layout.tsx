import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "RubinOT Stats - Character Tracking Platform",
  description:
    "Track and analyze character statistics for RubinOT MMORPG. View auctions, market data, and player progress.",
  keywords: [
    "RubinOT",
    "MMORPG",
    "character stats",
    "tracking",
    "auctions",
    "market",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <AnalyticsTracker />
        <FeedbackWidget />
      </body>
    </html>
  );
}
