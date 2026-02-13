# Project: RubinOT Stats

## Overview
Character tracking and auction analytics platform for the RubinOT MMORPG server. Built with Next.js, Prisma (SQLite), Playwright, and Cheerio.

## Key Directories
- `src/lib/scraper/` - Playwright + Cheerio scraper (browser.ts, auctions.ts)
- `scripts/scrape.ts` - CLI entry point for scraping
- `prisma/schema.prisma` - Database schema (SQLite)
- `src/app/` - Next.js App Router pages
- `data/` - Scraped JSON output (gitignored)

## Database
- **SQLite** at `prisma/dev.db`
- Connection: `DATABASE_URL="file:./dev.db"` in `.env`
- Generate client: `npx prisma generate`
- Push schema: `npx prisma db push`

## Skills

### /Rubinot-auctions
Scrape sold auction data from the RubinOT Character Bazaar.

**Usage:**
```
/Rubinot-auctions <count>
```

**What it does:**
1. Scrapes sold auctions from pastcharactertrades using Brave browser
2. Skips already-saved auctions automatically
3. Visits each auction's detail page for full stats
4. Saves incrementally to SQLite (safe to interrupt)
5. Rate limited with randomized 1-4s delays

**Skill file:** `.claude/skills/Rubinot-auctions.md`

## Common Commands

```bash
# Scrape 20 new auctions
pnpm scrape --auctions --count 20

# Scrape a single auction by ID
pnpm scrape --auction 153674

# Scrape first N pages (all auctions on those pages)
pnpm scrape --auctions --pages 5

# Dev server
pnpm dev
```
