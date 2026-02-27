"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Loader2,
  Trash2,
  Lightbulb,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronUp,
} from "lucide-react";
import { redirect } from "next/navigation";

interface FeatureRequest {
  id: number;
  title: string;
  description: string | null;
  authorName: string | null;
  status: string;
  voteCount: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Lightbulb; color: string }> = {
  open: { label: "Open", icon: Lightbulb, color: "text-sky-400 bg-sky-400/10 border-sky-400/30" },
  planned: { label: "Planned", icon: Clock, color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  completed: { label: "Done", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  declined: { label: "Declined", icon: XCircle, color: "text-red-400 bg-red-400/10 border-red-400/30" },
};

const STATUSES = ["open", "planned", "completed", "declined"] as const;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AdminFeatureRequestsClient() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    fetch("/api/feature-requests?status=all&sort=newest")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRequests(data.data.requests);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  async function updateStatus(id: number, status: string) {
    setActing(id);
    const res = await fetch(`/api/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
    setActing(null);
  }

  async function deleteRequest(id: number) {
    setActing(id);
    const res = await fetch(`/api/feature-requests/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
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

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const counts: Record<string, number> = { all: requests.length };
  for (const s of STATUSES) {
    counts[s] = requests.filter((r) => r.status === s).length;
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((status) => {
          const isActive = filter === status;
          const conf = status === "all" ? null : STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-accent"
              }`}
            >
              {conf && <conf.icon className="h-3.5 w-3.5" />}
              {status === "all" ? "All" : conf?.label}
              <span className="ml-1 text-[10px] opacity-70">({counts[status]})</span>
            </button>
          );
        })}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No feature requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const conf = STATUS_CONFIG[req.status] || STATUS_CONFIG.open;
            const StatusIcon = conf.icon;
            return (
              <div
                key={req.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold">{req.title}</h3>
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${conf.color}`}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {conf.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ChevronUp className="h-3 w-3" />
                        {req.voteCount}
                      </span>
                    </div>
                    {req.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {req.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {req.authorName && <span>by {req.authorName}</span>}
                      <span>{timeAgo(req.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Status actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {STATUSES.filter((s) => s !== req.status).map((status) => {
                    const sConf = STATUS_CONFIG[status];
                    const SIcon = sConf.icon;
                    return (
                      <button
                        key={status}
                        onClick={() => updateStatus(req.id, status)}
                        disabled={acting === req.id}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50 ${sConf.color}`}
                      >
                        {acting === req.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SIcon className="h-3 w-3" />
                        )}
                        {sConf.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => deleteRequest(req.id)}
                    disabled={acting === req.id}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {acting === req.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
