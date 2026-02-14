"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Moon, Sun } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { MobileNav } from "./MobileNav";

export function Header() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">RubinOT Stats</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-6 md:flex">
          <Link
            href="/"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Home
          </Link>
          <Link
            href="/auctions"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Auctions
          </Link>
          <Link
            href="/market"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Market
          </Link>
          <Link
            href="/progression"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Progression
          </Link>
        </nav>

        {/* Search Bar - Hidden on mobile */}
        <div className="hidden flex-1 md:flex md:justify-center">
          <SearchBar />
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="hidden rounded-md p-2 hover:bg-accent md:inline-flex"
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="rounded-md p-2 hover:bg-accent md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="border-t px-4 py-3 md:hidden">
        <SearchBar />
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </header>
  );
}
