# Project: RubinOT Stats

## Overview
Character tracking and auction analytics platform for the RubinOT MMORPG server. Think GuildStats for Tibia, but for Rubinot. Tracks character experience/skill progression over time and analyzes the auction market.

**Tech stack:** Next.js 16, TypeScript, Prisma, PostgreSQL (Railway), Playwright + Cheerio, Recharts, Tailwind CSS.

**Repo:** https://github.com/RAML1/rubinotstats (branch: staging)

## Infrastructure

- **Database:** PostgreSQL on Railway (RubinotStats project)
  - Connection: `DATABASE_URL` in `.env` (public Railway URL)
  - Internal: `postgres.railway.internal:5432`
  - External: `nozomi.proxy.rlwy.net:51867`
- **Credentials:** See `credentials.txt` in Claude's Office root (RUBINOTSTATS section)

## Key Directories
- `scripts/scrape.ts` — Auction scraper CLI
- `scripts/scrape-highscores.ts` — Highscores scraper CLI
- `src/lib/scraper/browser.ts` — Playwright browser manager (Brave + Cloudflare bypass)
- `src/lib/scraper/auctions.ts` — Auction list/detail page parser
- `src/lib/scraper/highscores.ts` — Highscores page parser
- `src/lib/utils/constants.ts` — Worlds (14), categories (19), vocations, URLs
- `prisma/schema.prisma` — Database schema (PostgreSQL)
- `prisma/seed.ts` — Seeds worlds + imports JSON data from `seeds/`
- `seeds/` — Exported JSON seed data (auctions.json, highscores.json)
- `data/` — Scraped JSON output (gitignored)
- `src/app/` — Next.js App Router pages (dashboard UI)

## Database Schema

| Table | Records | Purpose |
|-------|---------|---------|
| `worlds` | 11 | Rubinot game worlds (Elysian, Lunarian, etc.) |
| `highscore_entries` | daily | Rank, score, vocation, level per world/category/date |
| `auctions` | growing | Sold character auctions with 37+ fields |
| `characters` | growing | Canonical character records |
| `character_snapshots` | daily | Daily exp/skill snapshots per character |
| `market_stats` | computed | Precomputed auction market statistics |
| `watchlist` | future | User watchlist (not implemented yet) |

## Scraper Commands

### Highscores (daily job)
```bash
# Full run: 14 worlds × 19 categories × up to 20 pages each
pnpm scrape:highscores

# Single world
pnpm scrape:highscores --world Lunarian

# Single category (aliases: exp, ml, sword, charm, etc.)
pnpm scrape:highscores --category exp

# Specific combo, limited pages
pnpm scrape:highscores --world Lunarian --category exp --pages 3

# Skip database, just save JSON
pnpm scrape:highscores --no-db

# Run headless (may trigger more Cloudflare)
pnpm scrape:highscores --headless
```

### Auctions
```bash
# Scrape sold auctions (auto-skips duplicates)
pnpm scrape --auctions

# Limit to N new auctions
pnpm scrape --auctions --count 20

# Scrape first N pages
pnpm scrape --auctions --pages 5

# Single auction by ID
pnpm scrape --auction 153674

# Headless mode
pnpm scrape --auctions --headless
```

### Database
```bash
pnpm db:generate     # Generate Prisma client
pnpm db:migrate      # Run migrations (prisma migrate dev)
pnpm db:push         # Push schema without migration
pnpm db:studio       # Open Prisma Studio
pnpm db:seed         # Seed worlds + import JSON data
```

## Scraper Notes

- **Browser:** Uses Brave (less Cloudflare triggers than Chromium)
- **Persistent context:** Cookies stored in `.browser-data/` to avoid re-challenges
- **Rate limiting:** 3-7s default delay, configurable (fast: 1-3s, slow: 6-12s)
- **Anti-detection:** Custom User-Agent, `--disable-blink-features=AutomationControlled`
- **Rubinot approved scraping** (asked permission, they said it's ok)

## Highscores Scope

14 worlds × 19 categories = 266 world/category combos.
Each combo can have up to 20 pages (50 entries/page = 1000 max).
Full run worst case: 266 × 20 = 5,320 page loads.
At ~5s average per page: ~7.5 hours for a full exhaustive run.
In practice, many combos have only 1-5 pages, so actual time is much shorter.

## Dev Server
```bash
pnpm dev    # Next.js dev server on :3000
```
