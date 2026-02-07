/**
 * Cron Job API Endpoint
 * Triggers the daily highscores scraper
 *
 * Protected by CRON_SECRET environment variable
 *
 * Usage:
 *   POST /api/cron/scrape
 *   Headers: Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyHighscoresScraper } from '@/lib/scraper/jobs/daily-highscores';
import { shutdownScraper } from '@/lib/scraper';

/**
 * POST /api/cron/scrape
 * Trigger the daily highscores scraper
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          message: 'CRON_SECRET environment variable is not set',
        },
        { status: 500 }
      );
    }

    // Check authorization header
    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Missing authorization header',
        },
        { status: 401 }
      );
    }

    // Verify Bearer token
    const token = authHeader.replace('Bearer ', '');
    if (token !== cronSecret) {
      console.warn('Invalid CRON_SECRET attempt');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Invalid authorization token',
        },
        { status: 401 }
      );
    }

    // Authorization successful, run the scraper
    console.log('Starting daily highscores scraper job...');

    const result = await runDailyHighscoresScraper();

    // Cleanup: Close the browser
    await shutdownScraper();

    const elapsed = Date.now() - startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    return NextResponse.json(
      {
        success: result.success,
        message: 'Scraper job completed',
        data: {
          jobResult: result,
          apiElapsedTime: `${elapsedMinutes} minutes`,
        },
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    console.error('Scraper job failed:', error);

    // Attempt to cleanup on error
    try {
      await shutdownScraper();
    } catch (cleanupError) {
      console.error('Failed to cleanup scraper:', cleanupError);
    }

    const elapsed = Date.now() - startTime;
    const elapsedMinutes = (elapsed / 60000).toFixed(2);

    return NextResponse.json(
      {
        success: false,
        error: 'Scraper job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          apiElapsedTime: `${elapsedMinutes} minutes`,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/scrape
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  // Verify authorization for health check too
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: 'Server configuration error',
      },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader.replace('Bearer ', '') !== cronSecret) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Scraper cron endpoint is healthy',
      endpoint: '/api/cron/scrape',
      method: 'POST',
      authentication: 'Bearer token required',
    },
    { status: 200 }
  );
}
