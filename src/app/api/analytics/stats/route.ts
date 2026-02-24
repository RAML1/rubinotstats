import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET: Aggregate analytics stats for ad pricing insights
export async function GET() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    const [
      totalVisitors,
      totalSessions,
      visitorsToday,
      visitorsWeek,
      visitorsMonth,
      pageViewsToday,
      pageViewsWeek,
      pageViewsMonth,
      topPagesRaw,
      countriesRaw,
      languagesRaw,
      referrersRaw,
    ] = await Promise.all([
      prisma.analyticsSession.findMany({ distinct: ['visitorId'], select: { visitorId: true } }).then(r => r.length),
      prisma.analyticsSession.count(),
      prisma.analyticsEvent.findMany({
        where: { eventType: 'page_view', createdAt: { gte: today } },
        distinct: ['visitorId'],
        select: { visitorId: true },
      }).then(r => r.length),
      prisma.analyticsEvent.findMany({
        where: { eventType: 'page_view', createdAt: { gte: weekAgo } },
        distinct: ['visitorId'],
        select: { visitorId: true },
      }).then(r => r.length),
      prisma.analyticsEvent.findMany({
        where: { eventType: 'page_view', createdAt: { gte: monthAgo } },
        distinct: ['visitorId'],
        select: { visitorId: true },
      }).then(r => r.length),
      prisma.analyticsEvent.count({ where: { eventType: 'page_view', createdAt: { gte: today } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'page_view', createdAt: { gte: weekAgo } } }),
      prisma.analyticsEvent.count({ where: { eventType: 'page_view', createdAt: { gte: monthAgo } } }),
      prisma.$queryRaw<{ page_path: string; views: bigint }[]>`
        SELECT page_path, COUNT(*) as views
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${monthAgo}
        GROUP BY page_path ORDER BY views DESC LIMIT 10`,
      prisma.$queryRaw<{ country: string; count: bigint }[]>`
        SELECT country, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE country IS NOT NULL AND started_at >= ${monthAgo}
        GROUP BY country ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw<{ language: string; count: bigint }[]>`
        SELECT language, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE language IS NOT NULL AND started_at >= ${monthAgo}
        GROUP BY language ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw<{ referrer: string; count: bigint }[]>`
        SELECT referrer, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE referrer IS NOT NULL AND referrer != '' AND started_at >= ${monthAgo}
        GROUP BY referrer ORDER BY count DESC LIMIT 20`,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalVisitors,
          totalSessions,
          visitorsToday,
          visitorsWeek,
          visitorsMonth,
          pageViewsToday,
          pageViewsWeek,
          pageViewsMonth,
        },
        topPages: topPagesRaw.map(r => ({ path: r.page_path, views: Number(r.views) })),
        countries: countriesRaw.map(r => ({ country: r.country, visitors: Number(r.count) })),
        languages: languagesRaw.map(r => ({ language: r.language, visitors: Number(r.count) })),
        referrers: referrersRaw.map(r => ({ referrer: r.referrer, visitors: Number(r.count) })),
      },
    });
  } catch (error) {
    console.error('Analytics stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
