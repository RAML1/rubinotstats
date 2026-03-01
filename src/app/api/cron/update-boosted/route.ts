import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint for updating boosted creature & boss.
 * Fetches /api/boosted from RubinOT server-side.
 * Secured with CRON_SECRET env var.
 *
 * Usage:
 *   Railway cron → POST /api/cron/update-boosted -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  if (authHeader !== `Bearer ${cronSecret}` && cronHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = 'https://rubinot.com.br';
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/boosted`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      return NextResponse.json({
        success: false,
        error: `Failed to reach RubinOT API: ${err instanceof Error ? err.message : 'timeout or network error'}`,
      }, { status: 200 });
    }
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `RubinOT API returned ${res.status}. Cloudflare may be blocking.`,
      }, { status: 200 });
    }

    const data = await res.json();
    const creature = data.monster;
    const boss = data.boss;

    if (!creature && !boss) {
      return NextResponse.json({ success: false, error: 'No boosted data in API response' }, { status: 200 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.boostedDaily.upsert({
      where: { date: today },
      update: {
        boostedCreature: creature?.name || null,
        creatureLooktype: creature?.looktype || null,
        boostedBoss: boss?.name || null,
        bossLooktype: boss?.looktype || null,
      },
      create: {
        date: today,
        boostedCreature: creature?.name || null,
        creatureLooktype: creature?.looktype || null,
        boostedBoss: boss?.name || null,
        bossLooktype: boss?.looktype || null,
      },
    });

    return NextResponse.json({
      success: true,
      creature: creature?.name || null,
      boss: boss?.name || null,
    });
  } catch (error) {
    console.error('Cron update-boosted error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
