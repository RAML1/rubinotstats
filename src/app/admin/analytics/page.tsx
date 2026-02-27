import type { Metadata } from "next";
import { AdminAnalyticsClient } from "./AdminAnalyticsClient";

export const metadata: Metadata = {
  title: "Analytics - Admin - RubinOT Stats",
};

export default function AdminAnalyticsPage() {
  return <AdminAnalyticsClient />;
}
