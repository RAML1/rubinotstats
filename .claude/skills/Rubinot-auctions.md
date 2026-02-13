# /Rubinot-auctions - RubinOT Auction Scraper

Scrape sold auction data from the RubinOT Character Bazaar and save to the local SQLite database.

## Usage

```
/Rubinot-auctions <count>
```

- `<count>` — Number of NEW auctions to scrape (skips already-saved ones)

## What it does

1. Runs `pnpm scrape --auctions --count <count>` from the project root
2. Uses **Brave browser** (non-headless) to bypass Cloudflare
3. **Pass 1**: Scrapes list pages to find sold auctions (Winning Bid only)
4. **Skips** auctions already in the SQLite database (by `externalId`)
5. **Pass 2**: Visits each new auction's detail page for full stats (skills, general, charm, prey, hirelings, store items, etc.)
6. **Saves incrementally** — each auction is upserted to the DB as soon as it's scraped, so no data is lost if interrupted
7. Rate limited with randomized 1-4s delays to avoid Cloudflare detection

## Implementation

Run this command from the `rubinotstats` project directory:

```bash
cd /Users/robertomartinez/Documents/rubinotstats && PATH="$HOME/.local/bin:$PATH" npx tsx scripts/scrape.ts --auctions --count <count>
```

Run in the background so the user can monitor progress. The browser window will be visible — if Cloudflare shows a human verification popup, the user needs to click it manually.

## Notes

- The scraper uses `--count` to limit how many NEW auctions to scrape (after filtering out existing ones)
- If no `--count` is provided, it scrapes all available sold auctions
- Output JSON is also saved to `data/auctions-YYYY-MM-DD.json`
- Database: SQLite at `prisma/dev.db`, schema in `prisma/schema.prisma`
- Re-running is safe — upsert prevents duplicates, `skipExternalIds` avoids re-visiting detail pages
