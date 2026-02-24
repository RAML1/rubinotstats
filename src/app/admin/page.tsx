import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Users, Clock, Crown, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin - RubinOT Stats",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/");

  const [totalUsers, premiumUsers, pendingRequests] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { premiumTier: { not: "free" } } }),
    prisma.premiumRequest.count({ where: { status: "pending" } }),
  ]);

  const cards = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      href: "/admin/users",
      color: "text-blue-400",
    },
    {
      label: "Premium Users",
      value: premiumUsers,
      icon: Crown,
      href: "/admin/users",
      color: "text-amber-400",
    },
    {
      label: "Pending Requests",
      value: pendingRequests,
      icon: Clock,
      href: "/admin/premium-requests",
      color: pendingRequests > 0 ? "text-red-400" : "text-green-400",
    },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Admin Panel</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-border bg-card p-6 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-3xl font-bold">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/premium-requests"
          className="rounded-xl border border-border bg-card p-6 hover:bg-accent transition-colors space-y-2"
        >
          <h2 className="text-lg font-semibold">Premium Requests</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve/reject premium upgrade requests.
          </p>
        </Link>
        <Link
          href="/admin/users"
          className="rounded-xl border border-border bg-card p-6 hover:bg-accent transition-colors space-y-2"
        >
          <h2 className="text-lg font-semibold">Manage Users</h2>
          <p className="text-sm text-muted-foreground">
            View all users and manage their premium status directly.
          </p>
        </Link>
      </div>
    </div>
  );
}
