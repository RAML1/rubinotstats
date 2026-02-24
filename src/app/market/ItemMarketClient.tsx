'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  Globe,
  Coins,
  Clock,
  User,
  MessageCircle,
  Package,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '@/lib/utils/formatters';

interface ItemListing {
  id: number;
  itemName: string;
  tier: number | null;
  price: number;
  quantity: number;
  characterName: string;
  world: string;
  contactInfo: string | null;
  description: string | null;
  isActive: boolean;
  creatorToken: string | null;
  soldAt: string | null;
  createdAt: string;
  expiresAt: string;
}

// ── Creator token (browser-local ownership) ──────────────────────────

function getCreatorToken(): string {
  const KEY = 'rubinotstats_creator_token';
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    token = token.slice(0, 64);
    localStorage.setItem(KEY, token);
  }
  return token;
}

// ── Currency conversion (same as auction cards) ──────────────────────

const BRL_PER_COIN = 0.10;
const CURRENCY_RATES: Record<string, { symbol: string; rate: number; code: string }> = {
  BRL: { symbol: 'R$', rate: 1, code: 'BRL' },
  USD: { symbol: '$', rate: 0.17, code: 'USD' },
  MXN: { symbol: '$', rate: 3.45, code: 'MXN' },
  VES: { symbol: 'Bs.', rate: 63.0, code: 'VES' },
};

function convertPrice(coins: number): Record<string, number> {
  const brlValue = coins * BRL_PER_COIN;
  const conversions: Record<string, number> = {};
  for (const [key, { rate }] of Object.entries(CURRENCY_RATES)) {
    conversions[key] = brlValue * rate;
  }
  return conversions;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
}

// ── Price tooltip ────────────────────────────────────────────────────

function PriceTooltip({ coins }: { coins: number }) {
  const [show, setShow] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const conversions = convertPrice(coins);

  useEffect(() => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipW = 224;
      const tooltipH = 180;
      let top = rect.top - tooltipH - 8;
      let left = rect.left + rect.width / 2 - tooltipW / 2;
      if (top < 8) top = rect.bottom + 8;
      if (left < 8) left = 8;
      if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - tooltipW - 8;
      setPos({ top, left });
    }
  }, [show]);

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="ml-1 inline-flex items-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
      </button>

      {show && pos && (
        <div
          className="fixed z-[9999] w-56 rounded-lg p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100"
          style={{
            backgroundColor: '#1a1a2e',
            border: '1px solid #3a3858',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            top: pos.top,
            left: pos.left,
          }}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Approximate Value
          </p>
          <div className="space-y-1.5">
            {Object.entries(CURRENCY_RATES).map(([key, { symbol, code }]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-medium" style={{ color: '#9a96b0' }}>{symbol} {code}</span>
                <span className="font-bold" style={{ color: '#e4e0f0' }}>
                  ~ {symbol} {formatCurrency(conversions[key])}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #3a3858' }}>
            <p className="text-[10px] text-center" style={{ color: '#7a7690' }}>
              Based on 1 RC ≈ R$ {BRL_PER_COIN}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeUntilExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

function timeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// ── Tier colors (more prominent) ────────────────────────────────────

const TIER_COLORS: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  1: { bg: '#3b82f620', border: '#3b82f640', text: '#60a5fa', glow: '#3b82f610' },
  2: { bg: '#8b5cf620', border: '#8b5cf640', text: '#a78bfa', glow: '#8b5cf610' },
  3: { bg: '#f59e0b20', border: '#f59e0b40', text: '#fbbf24', glow: '#f59e0b10' },
  4: { bg: '#ef444420', border: '#ef444440', text: '#f87171', glow: '#ef444410' },
  5: { bg: '#ec489920', border: '#ec489940', text: '#f472b6', glow: '#ec489910' },
  6: { bg: '#14b8a620', border: '#14b8a640', text: '#2dd4bf', glow: '#14b8a610' },
  7: { bg: '#f9731620', border: '#f9731640', text: '#fb923c', glow: '#f9731610' },
  8: { bg: '#06b6d420', border: '#06b6d440', text: '#22d3ee', glow: '#06b6d410' },
  9: { bg: '#a855f720', border: '#a855f740', text: '#c084fc', glow: '#a855f710' },
  10: { bg: '#eab30820', border: '#eab30840', text: '#fde047', glow: '#eab30810' },
};

function TierBadge({ tier }: { tier: number }) {
  const c = TIER_COLORS[tier] || { bg: '#6b728015', border: '#6b728030', text: '#9ca3af', glow: '#6b728008' };
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      Tier {tier}
    </span>
  );
}

// ── Item Listing Card ───────────────────────────────────────────────

function ItemListingCard({
  listing,
  isOwner,
  onMarkSold,
  onRemove,
}: {
  listing: ItemListing;
  isOwner: boolean;
  onMarkSold: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const tierColor = listing.tier != null ? TIER_COLORS[listing.tier] || null : null;

  return (
    <Card
      className="transition-all hover:shadow-lg hover:shadow-black/20 flex flex-col relative"
      style={{
        backgroundColor: '#302e3a',
        border: tierColor ? `1px solid ${tierColor.border}` : '1px solid #4a4857',
        boxShadow: tierColor ? `0 0 12px ${tierColor.glow}` : undefined,
      }}
    >
      <CardContent className="p-0 flex flex-col flex-1">
        {/* Item header */}
        <div className="px-3.5 pt-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Package className="h-4 w-4 shrink-0" style={{ color: tierColor?.text || '#a78bfa' }} />
                <span className="text-sm font-bold truncate" style={{ color: '#e2e0ea' }}>
                  {listing.itemName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {listing.tier != null && <TierBadge tier={listing.tier} />}
                {listing.quantity > 1 && (
                  <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: '#252333', color: '#8a8698' }}>
                    x{listing.quantity}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="px-3.5 pb-2">
          <div
            className="flex items-center justify-between rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: '#1a2a1a', border: '1px solid #2a4a2a' }}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#5a8a5a' }}>
              Price
            </span>
            <div className="flex items-center gap-0.5">
              <Coins className="h-3 w-3" style={{ color: '#4ade80' }} />
              <span className="text-xs font-bold" style={{ color: '#4ade80' }}>
                {formatNumber(listing.price)} RC
              </span>
              <PriceTooltip coins={listing.price} />
            </div>
          </div>
        </div>

        {/* Seller info */}
        <div className="px-3.5 pb-2">
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded px-2 py-1.5" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
              <div className="flex items-center gap-1">
                <User className="h-2.5 w-2.5 shrink-0" style={{ color: '#7a7690' }} />
                <span className="text-[9px] truncate" style={{ color: '#a09cb0' }}>
                  {listing.characterName}
                </span>
              </div>
            </div>
            <div className="rounded px-2 py-1.5" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
              <div className="flex items-center gap-1">
                <Globe className="h-2.5 w-2.5 shrink-0" style={{ color: '#7a7690' }} />
                <span className="text-[9px] truncate" style={{ color: '#a09cb0' }}>
                  {listing.world}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact info */}
        {listing.contactInfo && (
          <div className="px-3.5 pb-2">
            <div className="flex items-center gap-1 rounded px-2 py-1" style={{ backgroundColor: '#252333', border: '1px solid #3a3848' }}>
              <MessageCircle className="h-2.5 w-2.5 shrink-0" style={{ color: '#7a7690' }} />
              <span className="text-[9px] truncate" style={{ color: '#a09cb0' }}>
                {listing.contactInfo}
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <div className="px-3.5 pb-2">
            <p className="text-[9px] line-clamp-2" style={{ color: '#7a7690' }}>
              {listing.description}
            </p>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Owner actions */}
        {isOwner && (
          <div className="px-3.5 pb-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => onMarkSold(listing.id)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: '#1a3a1a', border: '1px solid #2a5a2a', color: '#4ade80' }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark as Sold
              </button>
              <button
                onClick={() => onRemove(listing.id)}
                className="flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: '#3a1a1a', border: '1px solid #5a2a2a', color: '#f87171' }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Footer: posted time + expiry */}
        <div className="px-3.5 pb-3">
          <div className="flex items-center justify-between">
            <span className="text-[8px]" style={{ color: '#5a5870' }}>
              Posted {timeAgo(listing.createdAt)}
            </span>
            <div className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" style={{ color: '#5a5870' }} />
              <span className="text-[8px]" style={{ color: '#5a5870' }}>
                {timeUntilExpiry(listing.expiresAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Listing Form ─────────────────────────────────────────────

function CreateListingForm({
  worlds,
  onSuccess,
}: {
  worlds: string[];
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    itemName: '',
    tier: '',
    price: '',
    quantity: '1',
    characterName: '',
    world: '',
    contactInfo: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/item-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: formData.itemName,
          tier: formData.tier ? parseInt(formData.tier) : null,
          price: parseInt(formData.price),
          quantity: parseInt(formData.quantity) || 1,
          characterName: formData.characterName,
          world: formData.world,
          contactInfo: formData.contactInfo || null,
          description: formData.description || null,
          creatorToken: getCreatorToken(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to create listing');
        return;
      }

      setFormData({
        itemName: '',
        tier: '',
        price: '',
        quantity: '1',
        characterName: '',
        world: '',
        contactInfo: '',
        description: '',
      });
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#252333',
    border: '1px solid #3a3848',
    color: '#e2e0ea',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md px-3 py-2 text-xs" style={{ backgroundColor: '#3a2020', color: '#f87171', border: '1px solid #5a2020' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Item Name *
          </label>
          <input
            type="text"
            required
            value={formData.itemName}
            onChange={(e) => setFormData(p => ({ ...p, itemName: e.target.value }))}
            placeholder="e.g. Sanguine Bow"
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Tier (optional)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={formData.tier}
            onChange={(e) => setFormData(p => ({ ...p, tier: e.target.value }))}
            placeholder="0-10"
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Price (RC) *
          </label>
          <input
            type="number"
            required
            min="1"
            value={formData.price}
            onChange={(e) => setFormData(p => ({ ...p, price: e.target.value }))}
            placeholder="500"
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Quantity
          </label>
          <input
            type="number"
            min="1"
            value={formData.quantity}
            onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Character Name *
          </label>
          <input
            type="text"
            required
            value={formData.characterName}
            onChange={(e) => setFormData(p => ({ ...p, characterName: e.target.value }))}
            placeholder="Your character"
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            World *
          </label>
          <Select value={formData.world} onValueChange={(v) => setFormData(p => ({ ...p, world: v }))}>
            <SelectTrigger className="h-9 text-sm" style={inputStyle}>
              <SelectValue placeholder="Select world" />
            </SelectTrigger>
            <SelectContent>
              {worlds.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Contact Info (optional)
          </label>
          <input
            type="text"
            value={formData.contactInfo}
            onChange={(e) => setFormData(p => ({ ...p, contactInfo: e.target.value }))}
            placeholder="Discord, in-game mail, etc."
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={inputStyle}
          />
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1 block" style={{ color: '#7a7690' }}>
            Description (optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
            placeholder="Additional details about the item..."
            rows={2}
            className="w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none"
            style={inputStyle}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[9px]" style={{ color: '#5a5870' }}>
          Listing expires after 30 days
        </span>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#3b2e6e', border: '1px solid #5b4e9e', color: '#c4b5fd' }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {loading ? 'Posting...' : 'Post Listing'}
        </button>
      </div>
    </form>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function ItemMarketClient() {
  const [listings, setListings] = useState<ItemListing[]>([]);
  const [worlds, setWorlds] = useState<string[]>([]);
  const [allWorlds, setAllWorlds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedWorld, setSelectedWorld] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [myToken, setMyToken] = useState<string | null>(null);
  const limit = 20;

  // Get creator token on mount
  useEffect(() => {
    setMyToken(getCreatorToken());
  }, []);

  // Fetch world list for form
  useEffect(() => {
    fetch('/api/world-types')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setAllWorlds(data.data.map((w: { worldName: string }) => w.worldName).sort());
        }
      })
      .catch(() => {});
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortBy,
        order: sortBy === 'price' ? 'asc' : 'desc',
      });
      if (selectedWorld !== 'all') params.set('world', selectedWorld);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/item-listings?${params}`);
      const data = await res.json();
      if (data.success) {
        setListings(data.data.listings);
        setTotal(data.data.total);
        setWorlds(data.data.worlds);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, selectedWorld, search]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    setPage(1);
    fetchListings();
  };

  const handleMarkSold = async (id: number) => {
    if (!myToken) return;
    try {
      const res = await fetch(`/api/item-listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false, creatorToken: myToken, markSold: true }),
      });
      const data = await res.json();
      if (data.success) fetchListings();
    } catch { /* silently handle */ }
  };

  const handleRemove = async (id: number) => {
    if (!myToken) return;
    try {
      const res = await fetch(`/api/item-listings/${id}?creatorToken=${myToken}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) fetchListings();
    } catch { /* silently handle */ }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar + Post button */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#7a7690' }} />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#e2e0ea' }}
          />
        </div>

        {/* World filter */}
        <Select value={selectedWorld} onValueChange={(v) => { setSelectedWorld(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[160px] text-sm" style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#a09cb0' }}>
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" style={{ color: '#7a7690' }} />
              <SelectValue placeholder="All Worlds" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Worlds</SelectItem>
            {worlds.map((w) => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[140px] text-sm" style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#a09cb0' }}>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" style={{ color: '#7a7690' }} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Newest</SelectItem>
            <SelectItem value="price">Lowest Price</SelectItem>
            <SelectItem value="itemName">Item Name</SelectItem>
          </SelectContent>
        </Select>

        {/* Post Item button */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors shrink-0"
              style={{ backgroundColor: '#3b2e6e', border: '1px solid #5b4e9e', color: '#c4b5fd' }}
            >
              <Plus className="h-4 w-4" />
              Post Item
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" style={{ backgroundColor: '#302e3a', border: '1px solid #4a4857' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#e2e0ea' }}>Post Item for Sale</DialogTitle>
              <DialogDescription style={{ color: '#7a7690' }}>
                Create a listing to advertise your item to other players.
              </DialogDescription>
            </DialogHeader>
            <CreateListingForm
              worlds={allWorlds.length > 0 ? allWorlds : worlds}
              onSuccess={handleCreateSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: '#7a7690' }}>
          {total} listing{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#7a7690' }} />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 mb-3" style={{ color: '#4a4857' }} />
          <p className="text-sm font-medium" style={{ color: '#7a7690' }}>No listings found</p>
          <p className="text-xs mt-1" style={{ color: '#5a5870' }}>
            Be the first to post an item for sale!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ItemListingCard
              key={listing.id}
              listing={listing}
              isOwner={!!myToken && listing.creatorToken === myToken}
              onMarkSold={handleMarkSold}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md p-1.5 transition-colors disabled:opacity-30"
            style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#a09cb0' }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs px-2" style={{ color: '#7a7690' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md p-1.5 transition-colors disabled:opacity-30"
            style={{ backgroundColor: '#252333', border: '1px solid #3a3848', color: '#a09cb0' }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
