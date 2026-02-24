import type { Metadata } from "next";
import { AdminPremiumRequestsClient } from "./AdminPremiumRequestsClient";

export const metadata: Metadata = {
  title: "Premium Requests - Admin",
};

export default function AdminPremiumRequestsPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Premium Requests</h1>
      <AdminPremiumRequestsClient />
    </div>
  );
}
