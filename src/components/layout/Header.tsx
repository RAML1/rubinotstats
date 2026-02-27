"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Menu,
  Home,
  Store,
  TrendingUp,
  Calculator,
  Zap,
  Megaphone,
  Heart,
  Lightbulb,
  Crown,
  Ban,
  ArrowRightLeft,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { BoostedBanner } from "./BoostedBanner";

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

export function Header() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations("nav");
  const th = useTranslations("header");

  return (
    <header className="sticky top-0 z-30">
      {/* Top bar — amber gradient */}
      <div
        className="relative"
        style={{
          background: 'linear-gradient(135deg, rgba(180,83,9,0.95) 0%, rgba(217,119,6,0.9) 40%, rgba(245,158,11,0.85) 100%)',
        }}
      >
        <div className="container mx-auto flex h-12 items-center gap-4 px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white shrink-0">
            <Logo size="sm" showText={false} />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">
              RubinOT Stats
            </span>
          </Link>

          {/* Ad Banner — center */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2.5 rounded-lg border border-white/20 bg-white/10 px-5 py-1.5 animate-pulse backdrop-blur-sm">
              <Megaphone className="h-4 w-4 text-white/90" />
              <span className="text-sm font-medium text-white/90">
                {th("adBanner")}
              </span>
            </div>
          </div>

          {/* Right side — boosted + locale + tip + auth + mobile menu */}
          <div className="ml-auto flex items-center gap-3">
            {/* Boosted creature & boss */}
            <BoostedBanner />

            {/* Tip message */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1 backdrop-blur-sm">
              <Heart className="h-3 w-3 text-white fill-white" />
              <span
                className="text-[11px] text-white/90"
                dangerouslySetInnerHTML={{ __html: th("tipMessage") }}
              />
            </div>

            {/* Language switcher */}
            <LocaleSwitcher />

            {/* User auth menu */}
            <UserMenu />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation bar — glassmorphic */}
      <div
        className="border-b"
        style={{
          backgroundColor: 'rgba(15, 20, 32, 0.85)',
          borderColor: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="container mx-auto px-4">
          <nav className="hidden items-center gap-0.5 md:flex h-10">
            {navItems.map(({ href, labelKey, icon: Icon }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-amber-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey)}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{
                        backgroundColor: '#f59e0b',
                        boxShadow: '0 0 8px rgba(245,158,11,0.6), 0 0 16px rgba(245,158,11,0.3)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </header>
  );
}
