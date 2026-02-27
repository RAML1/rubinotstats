"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Loader2,
  Trash2,
  Bug,
  Lightbulb,
  MessageSquare,
  Mail,
} from "lucide-react";
import { redirect } from "next/navigation";

interface FeedbackItem {
  id: number;
  type: string;
  message: string;
  page: string | null;
  email: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: "Bug", icon: Bug, color: "text-red-400 bg-red-400/10 border-red-400/30" },
  feature: { label: "Feature", icon: Lightbulb, color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  general: { label: "General", icon: MessageSquare, color: "text-sky-400 bg-sky-400/10 border-sky-400/30" },
};

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

export function AdminFeedbackClient() {
  const { data: session } = useSession();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setFeedback(data.data);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  async function deleteFeedback(id: number) {
    setDeleting(id);
    const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setFeedback((prev) => prev.filter((f) => f.id !== id));
    }
    setDeleting(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = filter === "all" ? feedback : feedback.filter((f) => f.type === filter);

  const counts = {
    all: feedback.length,
    bug: feedback.filter((f) => f.type === "bug").length,
    feature: feedback.filter((f) => f.type === "feature").length,
    general: feedback.filter((f) => f.type === "general").length,
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "bug", "feature", "general"] as const).map((type) => {
          const isActive = filter === type;
          const conf = type === "all" ? null : TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-accent"
              }`}
            >
              {conf && <conf.icon className="h-3.5 w-3.5" />}
              {type === "all" ? "All" : conf?.label}
              <span className="ml-1 text-[10px] opacity-70">({counts[type]})</span>
            </button>
          );
        })}
      </div>

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const conf = TYPE_CONFIG[item.type] || TYPE_CONFIG.general;
            const TypeIcon = conf.icon;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${conf.color}`}>
                      <TypeIcon className="h-3 w-3" />
                      {conf.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  </div>
                  <button
                    onClick={() => deleteFeedback(item.id)}
                    disabled={deleting === item.id}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {item.message}
                </p>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.page && (
                    <span className="font-mono bg-secondary/50 rounded px-2 py-0.5">
                      {item.page}
                    </span>
                  )}
                  {item.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {item.email}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
