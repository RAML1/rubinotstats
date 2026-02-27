import type { Metadata } from "next";
import { AdminFeedbackClient } from "./AdminFeedbackClient";

export const metadata: Metadata = {
  title: "Feedback - Admin - RubinOT Stats",
};

export default function AdminFeedbackPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Feedback</h1>
      <AdminFeedbackClient />
    </div>
  );
}
