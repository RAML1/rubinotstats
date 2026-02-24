import type { Metadata } from "next";
import { AdminUsersClient } from "./AdminUsersClient";

export const metadata: Metadata = {
  title: "Users - Admin",
};

export default function AdminUsersPage() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Manage Users</h1>
      <AdminUsersClient />
    </div>
  );
}
