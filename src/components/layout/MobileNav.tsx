"use client";

import { useState } from "react";
import { X, Home, Gavel, Store } from "lucide-react";
import Link from "next/link";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-background shadow-lg">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 space-y-1 px-4 py-6">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Home className="h-5 w-5" />
              Home
            </Link>
            <Link
              href="/auctions"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Gavel className="h-5 w-5" />
              Auctions
            </Link>
            <Link
              href="/market"
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Store className="h-5 w-5" />
              Market
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
