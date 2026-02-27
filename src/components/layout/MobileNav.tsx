"use client";

import {
  X,
  Home,
  Store,
  TrendingUp,
  Calculator,
  Zap,
  Lightbulb,
  Crown,
  Ban,
  ArrowRightLeft,
  LogOut,
  Shield,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useSession, signIn, signOut } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitcher } from "./LocaleSwitcher";

const navItems = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/current-auctions", labelKey: "currentAuctions", icon: Zap },
  { href: "/market", labelKey: "itemMarket", icon: Store },
  { href: "/progression", labelKey: "progression", icon: TrendingUp },
  { href: "/calculator", labelKey: "skillCalculator", icon: Calculator },
  { href: "/bans", labelKey: "bans", icon: Ban },
  { href: "/transfers", labelKey: "transfers", icon: ArrowRightLeft },
  { href: "/insights", labelKey: "premium", icon: Crown },
  { href: "/feature-requests", labelKey: "featureRequests", icon: Lightbulb },
] as const;

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const t = useTranslations("nav");
  const ta = useTranslations("auth");

  const isPremium =
    session?.user?.premiumTier === "legacy" ||
    (session?.user?.premiumTier === "subscriber" &&
      session?.user?.premiumUntil &&
      new Date(session.user.premiumUntil) > new Date());

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xs shadow-2xl"
        style={{
          backgroundColor: 'rgba(15, 20, 32, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex h-full flex-col">
          {/* Header — amber gradient strip */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{
              borderBottom: '1px solid rgba(245,158,11,0.2)',
              background: 'linear-gradient(135deg, rgba(180,83,9,0.15) 0%, rgba(245,158,11,0.08) 100%)',
            }}
          >
            <Logo size="sm" />
            <LocaleSwitcher />
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map(({ href, labelKey, icon: Icon }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-amber-400"
                      : "text-foreground hover:bg-white/5"
                  }`}
                  style={isActive ? {
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    borderLeft: '3px solid #f59e0b',
                  } : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </Link>
              );
            })}
          </nav>

          {/* Auth section */}
          <div
            className="px-4 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            {status === "loading" ? (
              <div className="h-10 animate-pulse rounded-xl bg-white/10" />
            ) : session ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-2 py-1">
                  {session.user.image ? (
                    <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/50 text-xs font-bold text-white">
                      {session.user.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                  {isPremium && <Crown className="h-4 w-4 text-amber-400 shrink-0" />}
                </div>
                {session.user.isAdmin && (
                  <NextLink
                    href="/admin"
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/5 transition-colors"
                  >
                    <Shield className="h-5 w-5" />
                    {ta("adminPanel")}
                  </NextLink>
                )}
                <button
                  onClick={() => { onClose(); signOut(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-white/5 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  {ta("signOut")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => { onClose(); signIn("google"); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {ta("signInWithGoogle")}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
