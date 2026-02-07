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

## Contributing

When contributing to this project, please follow these guidelines:
- Use TypeScript for type safety
- Follow the ESLint and Prettier configuration
- Write descriptive commit messages
- Test changes locally with `pnpm dev` before submitting

## License

Proprietary - All rights reserved
