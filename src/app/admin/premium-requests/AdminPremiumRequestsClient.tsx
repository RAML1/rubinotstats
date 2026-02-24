"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Crown,
} from "lucide-react";
import { redirect } from "next/navigation";

interface PremiumRequestWithUser {
  id: number;
  userId: string;
  characterName: string;
  requestedTier: string;
  rcAmount: number | null;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    premiumTier: string;
  };
}

export function AdminPremiumRequestsClient() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<PremiumRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    fetch("/api/admin/premium-requests")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRequests(data.data);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  async function handleAction(
    id: number,
    status: "approved" | "rejected",
    adminNote?: string
  ) {
    setActing(id);
    const res = await fetch(`/api/admin/premium-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote }),
    });
    const data = await res.json();
    if (data.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, adminNote: adminNote || null, reviewedAt: new Date().toISOString() } : r))
      );
    }
    setActing(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      {/* Pending */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-400" />
          Pending ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        )}
        {pending.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-amber-400/30 bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {r.user.image ? (
                  <img src={r.user.image} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                    {r.user.name?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{r.user.name || r.user.email}</p>
                  <p className="text-xs text-muted-foreground">{r.user.email}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                <Crown className="h-3 w-3" />
                {r.requestedTier === "legacy" ? "Legacy" : "Subscriber"}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Character: <strong className="text-foreground">{r.characterName}</strong>
              {r.rcAmount ? (
                <> &middot; {r.rcAmount} RC</>
              ) : null}
              &nbsp;&middot; {new Date(r.createdAt).toLocaleDateString()}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAction(r.id, "approved")}
                disabled={acting === r.id}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {acting === r.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve
              </button>
              <button
                onClick={() => handleAction(r.id, "rejected", "Payment not verified")}
                disabled={acting === r.id}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Reviewed ({reviewed.length})
          </h2>
          {reviewed.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              {r.status === "approved" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.user.name || r.user.email} &middot; {r.characterName}
                  {r.rcAmount ? ` · ${r.rcAmount} RC` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.requestedTier === "legacy" ? "Legacy" : "Subscriber"} &middot;{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                  {r.adminNote && ` — ${r.adminNote}`}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.status === "approved"
                    ? "bg-green-500/15 text-green-500"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
