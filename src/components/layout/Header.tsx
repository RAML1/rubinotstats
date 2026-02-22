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
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "./MobileNav";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/current-auctions", label: "Current Auctions", icon: Zap },
  { href: "/market", label: "Market", icon: Store },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/calculator", label: "Calculator", icon: Calculator },
];

export function Header() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30">
      {/* Main navigation bar — colored background like ExevoPan */}
      <div className="bg-primary">
        <div className="container mx-auto flex h-14 items-center gap-4 px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-white">
            <Logo size="sm" showText={false} />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">
              RubinOT Stats
            </span>
          </Link>

          {/* Desktop Navigation — icon + label pills */}
          <nav className="hidden items-center gap-1 md:flex ml-4">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
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

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </header>
  );
}
