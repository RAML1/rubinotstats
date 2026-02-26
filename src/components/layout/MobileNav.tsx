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
  { href: "/bans", label: "Bans", icon: Ban },
  { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
  { href: "/insights", label: "Premium", icon: Crown },
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
                      ? "text-amber-400"
                      : "text-foreground hover:bg-white/5"
                  }`}
                  style={isActive ? {
                    backgroundColor: 'rgba(245,158,11,0.1)',
                    borderLeft: '3px solid #f59e0b',
                  } : undefined}
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
