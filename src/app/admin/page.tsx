import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Users, Clock, Crown, Shield, BarChart3, Eye, ChevronRight, MessageCircle, MessageSquare, Lightbulb } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin - RubinOT Stats",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const [
    totalUsers,
    premiumUsers,
    pendingRequests,
    unreadMessages,
    totalFeedback,
    openFeatureRequests,
    visitorsToday,
    pageViewsToday,
    visitorsWeek,
    pageViewsWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { premiumTier: { not: "free" } } }),
    prisma.premiumRequest.count({ where: { status: "pending" } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.feedback.count(),
    prisma.featureRequest.count({ where: { status: "open" } }),
    prisma.analyticsEvent.findMany({
      where: { eventType: "page_view", createdAt: { gte: today } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }).then((r) => r.length),
    prisma.analyticsEvent.count({
      where: { eventType: "page_view", createdAt: { gte: today } },
    }),
    prisma.analyticsEvent.findMany({
      where: { eventType: "page_view", createdAt: { gte: weekAgo } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }).then((r) => r.length),
    prisma.analyticsEvent.count({
      where: { eventType: "page_view", createdAt: { gte: weekAgo } },
    }),
  ]);

  const userCards = [
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

  const analyticsCards = [
    {
      label: "Visitors Today",
      value: visitorsToday,
      icon: Users,
      color: "text-emerald-400",
    },
    {
      label: "Page Views Today",
      value: pageViewsToday,
      icon: Eye,
      color: "text-sky-400",
    },
    {
      label: "Visitors This Week",
      value: visitorsWeek,
      icon: Users,
      color: "text-violet-400",
    },
    {
      label: "Page Views This Week",
      value: pageViewsWeek,
      icon: Eye,
      color: "text-orange-400",
    },
  ];

  const navCards = [
    {
      label: "Premium Requests",
      description: "Review and approve/reject premium upgrade requests.",
      href: "/admin/premium-requests",
      icon: Crown,
      accentColor: "border-l-amber-400",
      iconColor: "text-amber-400",
      badge: pendingRequests > 0 ? pendingRequests : null,
      badgeColor: "bg-red-500 text-white",
    },
    {
      label: "Manage Users",
      description: "View all users and manage their premium status directly.",
      href: "/admin/users",
      icon: Users,
      accentColor: "border-l-blue-400",
      iconColor: "text-blue-400",
      badge: null,
      badgeColor: "",
    },
    {
      label: "Analytics",
      description: "View traffic, top pages, countries, and search queries.",
      href: "/admin/analytics",
      icon: BarChart3,
      accentColor: "border-l-emerald-400",
      iconColor: "text-emerald-400",
      badge: null,
      badgeColor: "",
    },
    {
      label: "Messages",
      description: "View contact messages from visitors.",
      href: "/admin/messages",
      icon: MessageCircle,
      accentColor: "border-l-violet-400",
      iconColor: "text-violet-400",
      badge: unreadMessages > 0 ? unreadMessages : null,
      badgeColor: "bg-violet-500 text-white",
    },
    {
      label: "Feedback",
      description: "View feedback submissions from the widget.",
      href: "/admin/feedback",
      icon: MessageSquare,
      accentColor: "border-l-sky-400",
      iconColor: "text-sky-400",
      badge: totalFeedback > 0 ? totalFeedback : null,
      badgeColor: "bg-sky-500 text-white",
    },
    {
      label: "Feature Requests",
      description: "Manage and update status of feature requests.",
      href: "/admin/feature-requests",
      icon: Lightbulb,
      accentColor: "border-l-yellow-400",
      iconColor: "text-yellow-400",
      badge: openFeatureRequests > 0 ? openFeatureRequests : null,
      badgeColor: "bg-yellow-500 text-black",
    },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Admin Panel</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {userCards.map((card) => (
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

      {/* Analytics overview */}
      <div>
        <Link href="/admin/analytics" className="flex items-center gap-2 mb-4 group">
          <BarChart3 className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
            Live Analytics
          </h2>
          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            View details &rarr;
          </span>
        </Link>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {analyticsCards.map((card) => (
            <Link
              key={card.label}
              href="/admin/analytics"
              className="rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <card.icon className={`h-6 w-6 ${card.color}`} />
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group rounded-xl border border-border border-l-4 ${card.accentColor} bg-card p-5 hover:bg-accent transition-all flex items-start gap-4`}
            >
              <card.icon className={`h-6 w-6 mt-0.5 ${card.iconColor} shrink-0`} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{card.label}</h3>
                  {card.badge && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
