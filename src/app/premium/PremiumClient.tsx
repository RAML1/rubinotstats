"use client";

import { useSession, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Crown,
  TrendingUp,
  Star,
  BarChart3,
  LogIn,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Flame,
  Lock,
} from "lucide-react";

interface PremiumRequest {
  id: number;
  characterName: string;
  requestedTier: string;
  rcAmount: number | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Fair Price Valuations",
    description:
      "See estimated market value for every auction based on historical sales data.",
  },
  {
    icon: Star,
    title: "Featured Auction",
    description:
      "Pin one of your auctions to the top of the listings for maximum visibility.",
  },
  {
    icon: BarChart3,
    title: "Market Insights",
    description:
      "Access detailed analytics: price trends, skill averages, best deals, and more.",
  },
];

interface LegacyCount {
  count: number;
  limit: number;
  remaining: number;
  isFull: boolean;
}

export function PremiumClient() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<PremiumRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [legacyCount, setLegacyCount] = useState<LegacyCount | null>(null);

  // Form state
  const [characterName, setCharacterName] = useState("");
  const [requestedTier, setRequestedTier] = useState<"legacy" | "subscriber">(
    "legacy"
  );
  const [rcAmount, setRcAmount] = useState("");

  useEffect(() => {
    // Fetch legacy count (public)
    fetch("/api/premium/legacy-count")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setLegacyCount(data.data);
          // Auto-switch to subscriber if legacy is full
          if (data.data.isFull && requestedTier === "legacy") {
            setRequestedTier("subscriber");
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      fetch("/api/premium-requests")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setRequests(data.data);
        })
        .finally(() => setLoading(false));
    }
  }, [session]);

  const isPremium =
    session?.user?.premiumTier === "legacy" ||
    (session?.user?.premiumTier === "subscriber" &&
      session?.user?.premiumUntil &&
      new Date(session.user.premiumUntil) > new Date());

  const pendingRequest = requests.find((r) => r.status === "pending");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/premium-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName, requestedTier, rcAmount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
        setRequests((prev) => [data.data, ...prev]);
        setCharacterName("");
        setRcAmount("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Premium hero image */}
      <div className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border border-amber-400/20 shadow-lg shadow-amber-400/5">
        <Image
          src="/premium-features.jpg"
          alt="Premium Status — Key Market Insights, Highlight Auctions, and more to come"
          width={600}
          height={600}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 space-y-2"
          >
            <f.icon className="h-6 w-6 text-amber-400" />
            <h3 className="font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </div>

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div
          onClick={() => {
            if (!legacyCount?.isFull) setRequestedTier("legacy");
          }}
          className={`rounded-xl border-2 p-6 space-y-2 transition-colors ${
            legacyCount?.isFull
              ? "border-border/50 opacity-60 cursor-not-allowed"
              : `cursor-pointer ${
                  requestedTier === "legacy"
                    ? "border-amber-400 bg-amber-400/5"
                    : "border-border hover:border-amber-400/50"
                }`
          }`}
        >
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-bold">Legacy Supporter</h3>
          </div>
          <p className="text-2xl font-bold text-amber-400">Lifetime</p>
          <p className="text-sm text-muted-foreground">
            One-time RC payment. Access all premium features forever.
          </p>
          {/* Legacy limit badge */}
          {legacyCount && (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              legacyCount.isFull
                ? "bg-red-500/15 text-red-400 border border-red-500/20"
                : legacyCount.remaining <= 5
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
            }`}>
              {legacyCount.isFull ? (
                <>
                  <Lock className="h-3 w-3" />
                  SOLD OUT — All {legacyCount.limit} spots claimed
                </>
              ) : (
                <>
                  <Flame className="h-3 w-3" />
                  {legacyCount.count}/{legacyCount.limit} spots claimed — {legacyCount.remaining} remaining
                </>
              )}
            </div>
          )}
        </div>

        <div
          onClick={() => setRequestedTier("subscriber")}
          className={`cursor-pointer rounded-xl border-2 p-6 space-y-2 transition-colors ${
            requestedTier === "subscriber"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Subscriber</h3>
          </div>
          <p className="text-2xl font-bold text-primary">Monthly</p>
          <p className="text-sm text-muted-foreground">
            Monthly RC payment. All premium features while active.
          </p>
        </div>
      </div>

      {/* Auth gate */}
      {status === "loading" ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !session ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <LogIn className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            Sign in with Google to request premium access.
          </p>
          <button
            onClick={() => signIn("google")}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      ) : isPremium ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-8 text-center space-y-2">
          <Crown className="mx-auto h-8 w-8 text-amber-400" />
          <p className="text-lg font-semibold text-amber-400">
            You&apos;re a{" "}
            {session.user.premiumTier === "legacy"
              ? "Legacy Supporter"
              : "Subscriber"}
            !
          </p>
          <p className="text-sm text-muted-foreground">
            All premium features are unlocked.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Instructions */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h3 className="font-semibold">How to get premium:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Send the RC amount to character{" "}
                <strong className="text-foreground">Super Bonk Lee</strong> in-game
              </li>
              <li>Fill out the form below with your character name</li>
              <li>
                We&apos;ll verify the payment and activate your premium within{" "}
                <strong className="text-foreground">24 hours</strong>
              </li>
            </ol>
          </div>

          {/* Pending request notice */}
          {pendingRequest && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Request pending review
                </p>
                <p className="text-sm text-muted-foreground">
                  Character: {pendingRequest.characterName} &middot;{" "}
                  {pendingRequest.requestedTier === "legacy"
                    ? "Legacy Supporter"
                    : "Subscriber"}
                  {pendingRequest.rcAmount
                    ? ` · ${pendingRequest.rcAmount} RC`
                    : ""}
                </p>
              </div>
            </div>
          )}

          {/* Request form */}
          {!pendingRequest && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Your character name
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="e.g. Super Bonk Lee"
                  required
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  RC amount sent
                </label>
                <input
                  type="number"
                  value={rcAmount}
                  onChange={(e) => setRcAmount(e.target.value)}
                  placeholder="Amount of RC sent"
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {success && (
                <p className="text-sm text-green-500">
                  Request submitted! We&apos;ll review it within 24 hours.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !characterName}
                className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Submit Premium Request"
                )}
              </button>
            </form>
          )}

          {/* Request history */}
          {requests.length > 0 && !loading && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Your requests
              </h3>
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {r.status === "pending" && (
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  )}
                  {r.status === "approved" && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  {r.status === "rejected" && (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.characterName} &middot;{" "}
                      {r.requestedTier === "legacy"
                        ? "Legacy"
                        : "Subscriber"}
                      {r.rcAmount ? ` · ${r.rcAmount} RC` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                      {r.adminNote && ` — ${r.adminNote}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.status === "pending"
                        ? "bg-amber-400/15 text-amber-400"
                        : r.status === "approved"
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
      )}
    </div>
  );
}
