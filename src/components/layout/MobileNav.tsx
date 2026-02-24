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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/current-auctions", label: "Current Auctions", icon: Zap },
  { href: "/market", label: "Item Market", icon: Store },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/calculator", label: "Skill Calculator", icon: Calculator },
  { href: "/insights", label: "Insights", icon: Crown },
  { href: "/feature-requests", label: "Feature Requests", icon: Lightbulb },
];

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-card shadow-2xl">
        <div className="flex h-full flex-col">
          {/* Header with logo */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Logo size="sm" />
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
