"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Home,
  Store,
  TrendingUp,
  Calculator,
  Zap,
  Megaphone,
  Heart,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "./MobileNav";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/current-auctions", label: "Current Auctions", icon: Zap },
  { href: "/market", label: "Item Market", icon: Store },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/calculator", label: "Calculator", icon: Calculator },
];

export function Header() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30">
      {/* Top bar — logo, ad banner, tip message */}
      <div className="bg-primary">
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
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-5 py-1.5 animate-pulse">
              <Megaphone className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-200">
                Your awesome reseller page here, travecos also welcome to advertise
              </span>
            </div>
          </div>

          {/* Right side — tip + mobile menu */}
          <div className="ml-auto flex items-center gap-3">
            {/* Tip message */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/25 px-3 py-1">
              <Heart className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span className="text-[11px] text-amber-300">
                Want to show love? Tip <strong>Super Bonk Lee</strong> so he can stop using plate set
              </span>
            </div>

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

      {/* Navigation bar — below the top bar */}
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <nav className="hidden items-center gap-1 md:flex h-10">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
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
