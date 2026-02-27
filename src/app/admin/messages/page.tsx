import type { Metadata } from "next";
import { AdminMessagesClient } from "./AdminMessagesClient";

export const metadata: Metadata = {
  title: "Messages - Admin - RubinOT Stats",
};

export default function AdminMessagesPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Contact Messages</h1>
      <AdminMessagesClient />
    </div>
  );
}
