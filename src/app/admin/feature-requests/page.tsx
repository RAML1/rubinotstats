import type { Metadata } from "next";
import { AdminFeatureRequestsClient } from "./AdminFeatureRequestsClient";

export const metadata: Metadata = {
  title: "Feature Requests - Admin - RubinOT Stats",
};

export default function AdminFeatureRequestsPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Feature Requests</h1>
      <AdminFeatureRequestsClient />
    </div>
  );
}
