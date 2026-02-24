'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronUp, Plus, Loader2, Lightbulb, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface FeatureRequest {
  id: number;
  title: string;
  description: string | null;
  authorName: string | null;
  status: string;
  voteCount: number;
  createdAt: string;
}

function getVoterToken(): string {
  const KEY = '_rs_voter_token';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '').slice(0, 28);
    token = token.replace(/-/g, '').slice(0, 64);
    localStorage.setItem(KEY, token);
  }
  return token;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Lightbulb; color: string }> = {
  open: { label: 'Open', icon: Lightbulb, color: 'text-sky-400 bg-sky-400/10 border-sky-400/30' },
  planned: { label: 'Planned', icon: Clock, color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  completed: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  declined: { label: 'Declined', icon: XCircle, color: 'text-red-400 bg-red-400/10 border-red-400/30' },
};

export function FeatureRequestsClient() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('votes');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const voterToken = getVoterToken();
      const params = new URLSearchParams({ status: filter, sort, voterToken });
      const res = await fetch(`/api/feature-requests?${params}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data.requests);
        setVotedIds(new Set(json.data.votedIds));
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filter, sort]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleVote(id: number) {
    const voterToken = getVoterToken();
    // Optimistic update
    const wasVoted = votedIds.has(id);
    setVotedIds((prev) => {
      const next = new Set(prev);
      if (wasVoted) next.delete(id);
      else next.add(id);
      return next;
    });
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, voteCount: r.voteCount + (wasVoted ? -1 : 1) } : r
      )
    );

    try {
      await fetch(`/api/feature-requests/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterToken }),
      });
    } catch {
      // Revert on error
      setVotedIds((prev) => {
        const next = new Set(prev);
        if (wasVoted) next.add(id);
        else next.delete(id);
        return next;
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, voteCount: r.voteCount + (wasVoted ? 1 : -1) } : r
        )
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 5) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          authorName: authorName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTitle('');
        setDescription('');
        setAuthorName('');
        setShowForm(false);
        fetchRequests();
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Suggest Feature
        </button>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="votes">Most Voted</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Submission Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-primary/30 bg-card p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Feature Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add world transfer cost estimator"
              maxLength={200}
              className="w-full rounded-lg border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
              minLength={5}
            />
            <p className="mt-1 text-xs text-muted-foreground">{title.length}/200</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the feature in detail..."
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">{description.length}/2000</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Your Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Character name or nickname"
              maxLength={100}
              className="w-full rounded-lg border border-border/50 bg-secondary px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || title.trim().length < 5}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border/50 px-4 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">No feature requests yet. Be the first to suggest one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const voted = votedIds.has(req.id);
            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.open;
            const StatusIcon = statusConf.icon;
            return (
              <div
                key={req.id}
                className="flex gap-3 rounded-xl border border-border/50 bg-card/50 p-4 transition-colors hover:bg-card"
              >
                {/* Vote button */}
                <button
                  onClick={() => handleVote(req.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors shrink-0 ${
                    voted
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  <ChevronUp className={`h-4 w-4 ${voted ? 'text-primary' : ''}`} />
                  {req.voteCount}
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="text-sm font-semibold leading-tight">{req.title}</h3>
                    <span
                      className={`shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConf.color}`}
                    >
                      <StatusIcon className="h-2.5 w-2.5" />
                      {statusConf.label}
                    </span>
                  </div>
                  {req.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {req.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {req.authorName && <span>by {req.authorName}</span>}
                    <span>{timeAgo(req.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
