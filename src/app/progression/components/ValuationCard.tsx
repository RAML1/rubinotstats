'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Lock, Loader2, TrendingUp, ExternalLink } from 'lucide-react';

interface ComparableAuction {
  externalId: string;
  characterName: string;
  level: number;
  vocation: string;
  soldPrice: number;
  similarity: number;
  url: string;
}

interface ValuationData {
  estimatedValue: number;
  confidence: 'high' | 'medium' | 'low';
  range: { min: number; max: number };
  sampleSize: number;
  comparables: ComparableAuction[];
}

interface Props {
  characterName: string;
}

const CONFIDENCE_STYLES = {
  high: { label: 'High Confidence', className: 'bg-green-500/15 text-green-500' },
  medium: { label: 'Medium Confidence', className: 'bg-amber-400/15 text-amber-400' },
  low: { label: 'Low Confidence', className: 'bg-red-400/15 text-red-400' },
};

function formatTC(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k TC`;
  return `${value} TC`;
}

export default function ValuationCard({ characterName }: Props) {
  const { data: session } = useSession();
  const [valuation, setValuation] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);

  const isPremiumUser =
    session?.user?.premiumTier === 'legacy' ||
    (session?.user?.premiumTier === 'subscriber' &&
      session?.user?.premiumUntil &&
      new Date(session.user.premiumUntil) > new Date());

  async function fetchValuation() {
    setLoading(true);
    setError(null);
    setNoData(false);
    try {
      const res = await fetch(`/api/valuation?characterName=${encodeURIComponent(characterName)}`);
      if (res.status === 401 || res.status === 403) {
        setError('Premium required');
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setValuation(json.data);
      } else if (json.success && !json.data) {
        setNoData(true);
      } else {
        setError(json.error || 'Failed to estimate value');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  // Not logged in or not premium — show locked state
  if (!isPremiumUser) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur relative overflow-hidden">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
          <Lock size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-medium">Premium Feature</p>
          <a
            href="/premium"
            className="text-xs text-primary hover:underline"
          >
            Upgrade to unlock
          </a>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={18} className="text-amber-400" />
            Estimated Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-muted-foreground/30">~??? TC</div>
          <p className="text-sm text-muted-foreground/30 mt-1">Based on similar sold auctions</p>
        </CardContent>
      </Card>
    );
  }

  // Premium user — not yet fetched
  if (!valuation && !loading && !error && !noData) {
    return (
      <Card className="border-amber-400/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={18} className="text-amber-400" />
            Estimated Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            onClick={fetchValuation}
            className="w-full rounded-lg bg-amber-400/10 border border-amber-400/20 px-4 py-3 text-sm font-medium text-amber-400 hover:bg-amber-400/20 transition-colors"
          >
            <TrendingUp size={16} className="inline mr-2" />
            Estimate Character Value
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            Compares against sold auction history using skill matching
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading
  if (loading) {
    return (
      <Card className="border-amber-400/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={18} className="text-amber-400" />
            Estimated Value
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-amber-400 mr-2" />
          <span className="text-sm text-muted-foreground">Analyzing auction history...</span>
        </CardContent>
      </Card>
    );
  }

  // Error or no data
  if (error || noData) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={18} className="text-amber-400" />
            Estimated Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {noData
              ? 'Not enough comparable auction data for this character yet.'
              : error}
          </p>
          <button
            onClick={fetchValuation}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    );
  }

  // Show valuation
  const conf = CONFIDENCE_STYLES[valuation!.confidence];
  return (
    <Card className="border-amber-400/20 bg-card/50 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign size={18} className="text-amber-400" />
          Estimated Value
          <Badge className={`ml-auto text-xs ${conf.className}`}>
            {conf.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-3xl font-bold text-amber-400">
            ~{formatTC(valuation!.estimatedValue)}
          </div>
          <p className="text-sm text-muted-foreground">
            Range: {formatTC(valuation!.range.min)} – {formatTC(valuation!.range.max)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on {valuation!.sampleSize} similar sold auctions
          </p>
        </div>

        {valuation!.comparables.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Most Similar Auctions</p>
            {valuation!.comparables.map((c) => (
              <div
                key={c.externalId}
                className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{c.characterName}</span>
                  <span className="text-muted-foreground shrink-0">L{c.level}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                    {c.similarity}% match
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-medium">{formatTC(c.soldPrice)}</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={fetchValuation}
          className="text-xs text-primary hover:underline"
        >
          Refresh estimate
        </button>
      </CardContent>
    </Card>
  );
}
