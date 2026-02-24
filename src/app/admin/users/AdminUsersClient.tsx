"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Crown, Shield, Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

interface UserData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  premiumTier: string;
  premiumSince: string | null;
  premiumUntil: string | null;
  isAdmin: boolean;
  createdAt: string;
  _count: { premiumRequests: number };
}

export function AdminUsersClient() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.isAdmin) return;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUsers(data.data);
      })
      .finally(() => setLoading(false));
  }, [session]);

  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  async function updateTier(userId: string, premiumTier: string) {
    setUpdating(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premiumTier }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, premiumTier, premiumSince: data.data.premiumSince, premiumUntil: data.data.premiumUntil }
            : u
        )
      );
    }
    setUpdating(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {users.length} users total
      </p>

      {users.map((u) => (
        <div
          key={u.id}
          className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
        >
          {u.image ? (
            <img src={u.image} alt="" className="h-10 w-10 rounded-full shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0">
              {u.name?.charAt(0) || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{u.name || "—"}</p>
              {u.isAdmin && <Shield className="h-3.5 w-3.5 text-primary shrink-0" />}
              {u.premiumTier !== "free" && (
                <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(u.createdAt).toLocaleDateString()}
              {u.premiumTier !== "free" && (
                <>
                  {" "}&middot; {u.premiumTier === "legacy" ? "Legacy Supporter" : "Subscriber"}
                  {u.premiumUntil && ` until ${new Date(u.premiumUntil).toLocaleDateString()}`}
                </>
              )}
            </p>
          </div>

          <div className="flex gap-1.5 shrink-0">
            {updating === u.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <button
                  onClick={() => updateTier(u.id, "free")}
                  disabled={u.premiumTier === "free"}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    u.premiumTier === "free"
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Free
                </button>
                <button
                  onClick={() => updateTier(u.id, "subscriber")}
                  disabled={u.premiumTier === "subscriber"}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    u.premiumTier === "subscriber"
                      ? "bg-primary/20 text-primary"
                      : "bg-primary/5 text-primary/70 hover:bg-primary/15"
                  }`}
                >
                  Sub
                </button>
                <button
                  onClick={() => updateTier(u.id, "legacy")}
                  disabled={u.premiumTier === "legacy"}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    u.premiumTier === "legacy"
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-amber-400/5 text-amber-400/70 hover:bg-amber-400/15"
                  }`}
                >
                  Legacy
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
