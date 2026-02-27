"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  Mail,
  MailOpen,
  Trash2,
} from "lucide-react";
import { redirect } from "next/navigation";

interface ContactMessage {
  id: number;
  name: string | null;
  contactType: string;
  contactValue: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

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

export function AdminMessagesClient() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    fetch("/api/admin/messages")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setMessages(data.data);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  async function toggleRead(id: number, isRead: boolean) {
    setActing(id);
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead }),
    });
    const data = await res.json();
    if (data.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isRead } : m))
      );
    }
    setActing(null);
  }

  async function deleteMessage(id: number) {
    setActing(id);
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
    setActing(null);
  }

  async function markAllRead() {
    const unread = messages.filter((m) => !m.isRead);
    for (const m of unread) {
      await fetch(`/api/admin/messages/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
    }
    setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unread = messages.filter((m) => !m.isRead);
  const read = messages.filter((m) => m.isRead);

  return (
    <div className="space-y-8">
      {/* Unread */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            Unread ({unread.length})
          </h2>
          {unread.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>
        {unread.length === 0 && (
          <p className="text-sm text-muted-foreground">No unread messages.</p>
        )}
        {unread.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-indigo-400/30 bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {m.name || "Anonymous"}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(m.createdAt)}</p>
              </div>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                m.contactType === "discord"
                  ? "bg-indigo-400/15 text-indigo-400"
                  : "bg-sky-400/15 text-sky-400"
              }`}>
                {m.contactType === "discord" ? "Discord" : "Telegram"}
              </span>
            </div>

            <p className="text-sm font-mono bg-secondary/50 rounded-lg px-3 py-2">
              {m.contactValue}
            </p>

            <p className="text-sm text-foreground/90 whitespace-pre-wrap">
              {m.message}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => toggleRead(m.id, true)}
                disabled={acting === m.id}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {acting === m.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark as read
              </button>
              <button
                onClick={() => deleteMessage(m.id)}
                disabled={acting === m.id}
                className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Read */}
      {read.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <MailOpen className="h-5 w-5" />
            Read ({read.length})
          </h2>
          {read.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {m.name || "Anonymous"}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.contactType === "discord"
                      ? "bg-indigo-400/15 text-indigo-400"
                      : "bg-sky-400/15 text-sky-400"
                  }`}>
                    {m.contactType === "discord" ? "Discord" : "Telegram"}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.contactValue}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{m.message}</p>
                <p className="text-xs text-muted-foreground/60">{timeAgo(m.createdAt)}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => toggleRead(m.id, false)}
                  disabled={acting === m.id}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  title="Mark as unread"
                >
                  <Mail className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteMessage(m.id)}
                  disabled={acting === m.id}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
