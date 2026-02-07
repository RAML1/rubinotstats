# Rubinotstats

A character tracking and auction analysis platform for the Brazilian MMORPG Rubinum Online.

## Overview

Rubinotstats is a comprehensive tool designed to help players track their characters, monitor market trends, and analyze auction data within the Rubinum Online economy.

## Setup Instructions

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm/yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rubinotstats
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Initialize the database:
```bash
pnpm prisma migrate dev
```

## Available Scripts

### Development
```bash
pnpm dev
```
Runs the development server at `http://localhost:3000`. The app automatically reloads on file changes.

### Production Build
```bash
pnpm build
```
Creates an optimized production build.

### Start Production Server
```bash
pnpm start
```
Starts the production server.

### Linting
```bash
pnpm lint
```
Runs ESLint to check code quality.

### Database Management
```bash
pnpm prisma migrate dev   # Run migrations
pnpm prisma studio       # Open Prisma Studio GUI
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Data Validation**: Zod
- **Web Scraping**: Cheerio
- **Icons**: Lucide React
- **Code Quality**: ESLint + Prettier
- **UI Utilities**: clsx, tailwind-merge, class-variance-authority

## Project Structure

```
src/
├── app/           # Next.js App Router pages and layouts
├── components/    # Reusable React components
├── lib/           # Utility functions and helpers
├── hooks/         # Custom React hooks
└── types/         # TypeScript type definitions
```

## Auction Scraper

Scrapes sold auction data from the [RubinOT Character Bazaar](https://rubinot.com.br/pastcharactertrades) using Playwright (non-headless to bypass Cloudflare) and Cheerio for HTML parsing.

### Setup

```bash
pnpm install
npx playwright install chromium
```

### Usage

```bash
# Scrape a single auction by ID
pnpm scrape --auction 153674

# Scrape all sold auction history (last 30 days)
pnpm scrape --auctions

# Scrape first N pages only
pnpm scrape --auctions --pages 10

# Run headless (may fail on Cloudflare)
pnpm scrape --headless
```

Output is saved to `./data/` as JSON.

### How It Works

1. **List pages** (`pastcharactertrades`) are scraped for basic auction info
2. Only **sold auctions** (Winning Bid) are kept; unsold/expired are skipped
3. Each sold auction's **detail page** is visited to extract full stats
4. Rate limited to 1.5s between requests

### Extracted Fields

| Field | Type | Source |
|---|---|---|
| `externalId` | string | List page - auction link URL |
| `characterName` | string | List/detail page - `.AuctionCharacterName` |
| `level` | number | List page - header text `Level: X` |
| `vocation` | string | List page - header text `Vocation: X` |
| `gender` | string | List page - header text `Male/Female` |
| `world` | string | List page - header text `World: X` |
| `auctionStart` | string | List page - `.ShortAuctionDataLabel` |
| `auctionEnd` | string | List page - `.ShortAuctionDataLabel` |
| `soldPrice` | number | List page - Winning Bid value (TC) |
| `coinsPerLevel` | number | Calculated: `soldPrice / level` |
| **Skills** | | Detail page - `td.LabelColumn b` + `td.LevelColumn` |
| `magicLevel` | number | Magic Level |
| `fist` | number | Fist Fighting |
| `club` | number | Club Fighting |
| `sword` | number | Sword Fighting |
| `axe` | number | Axe Fighting |
| `distance` | number | Distance Fighting |
| `shielding` | number | Shielding |
| `fishing` | number | Fishing |
| **General Stats** | | Detail page - `span.LabelV` + sibling div |
| `hitPoints` | number | Hit Points |
| `mana` | number | Mana |
| `capacity` | number | Capacity |
| `speed` | number | Speed |
| `experience` | string | Experience (kept as string for large numbers) |
| `creationDate` | string | Creation Date |
| `achievementPoints` | number | Achievement Points |
| `mountsCount` | number | Mounts |
| `outfitsCount` | number | Outfits |
| `titlesCount` | number | Titles |
| `linkedTasks` | number | Linked Tasks |
| `dailyRewardStreak` | number | Daily Reward Streak |
| **Charm** | | |
| `charmExpansion` | boolean | Detail page - `span.LabelV` |
| `charmPoints` | number | List page - SpecialCharacterFeatures |
| `unusedCharmPoints` | number | List page - SpecialCharacterFeatures |
| `spentCharmPoints` | number | Detail page - `span.LabelV` |
| **Prey & Hunting** | | Detail page - `span.LabelV` |
| `preySlots` | number | Permanent Prey Slots |
| `preyWildcards` | number | Prey Wildcards |
| `huntingTaskPoints` | number | Hunting Task Points |
| **Hirelings** | | Detail page - `span.LabelV` |
| `hirelings` | number | Hirelings count |
| `hirelingJobs` | number | Hireling Jobs |
| **Items** | | Detail page - `Results: X` in Store Item Summary |
| `storeItemsCount` | number | Total store items |
| **Other** | | |
| `bossPoints` | number | List page - SpecialCharacterFeatures |
| `blessingsCount` | number | Detail page - `span.LabelV` |
| `exaltedDust` | string | List page - SpecialCharacterFeatures (e.g. "216/271") |
| `gold` | number | List page - SpecialCharacterFeatures |
| `bestiary` | number | List page - SpecialCharacterFeatures (completed count) |
| `url` | string | Full auction detail page URL |

### Architecture

```
src/lib/scraper/
├── browser.ts     # Playwright browser manager, Cloudflare bypass, rate limiting
└── auctions.ts    # Auction parsing (list pages + detail pages)

scripts/
└── scrape.ts      # CLI entry point (pnpm scrape)
```

## Contributing

When contributing to this project, please follow these guidelines:
- Use TypeScript for type safety
- Follow the ESLint and Prettier configuration
- Write descriptive commit messages
- Test changes locally with `pnpm dev` before submitting

## License

Proprietary - All rights reserved
