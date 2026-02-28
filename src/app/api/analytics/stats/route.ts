import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

// GET: Comprehensive admin dashboard stats
export async function GET() {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Use America/Mexico_City (CST, UTC-6) so "today" matches the admin's local time
    // Get current date parts in MX timezone, then build midnight-MX as a UTC timestamp
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
    const mxDateStr = formatter.format(new Date()); // "2026-02-27"
    const [y, m, d] = mxDateStr.split('-').map(Number);
    // Midnight in MX (UTC-6) = 06:00 UTC
    const today = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T06:00:00.000Z`);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000);

    // Subquery to exclude admin visitors (those who ever visited /admin pages)
    // Using a raw SQL fragment since visitor_id is UUID type
    const adminExclude = Prisma.sql`AND visitor_id NOT IN (SELECT DISTINCT visitor_id FROM analytics_events WHERE page_path LIKE '/admin%')`;
    const excludeAdmin = adminExclude;
    const excludeAdminSession = adminExclude;

    const [
      // Traffic (all exclude admin visitors)
      totalVisitorsRaw,
      totalSessionsRaw,
      visitorsTodayRaw,
      visitorsWeekRaw,
      visitorsMonthRaw,
      pageViewsTodayRaw,
      pageViewsWeekRaw,
      pageViewsMonthRaw,
      topPagesRaw,
      countriesRaw,
      languagesRaw,
      referrersRaw,
      dailyTrafficRaw,
      recentSearchesRaw,
      topSearchesRaw,

      // Auctions
      totalAuctions,
      auctionStatusRaw,
      activeAuctions,
      avgSoldPrice,
      vocationBreakdownRaw,
      dailyAuctionsRaw,
      worldDistributionRaw,

      // Users
      totalUsers,
      premiumUsers,
      pendingRequests,
      userListRaw,
      premiumRequestsRaw,

      // Game Data
      totalBans,
      activeBans,
      totalTransfers,
      recentTransfersRaw,

      // Community
      totalFeatureRequests,
      totalFeedback,
      totalListings,
    ] = await Promise.all([
      // -- Traffic (excluding admin visitors) --
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions WHERE 1=1 ${excludeAdminSession}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM analytics_sessions WHERE 1=1 ${excludeAdminSession}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${today} ${excludeAdmin}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${weekAgo} ${excludeAdmin}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT visitor_id) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${monthAgo} ${excludeAdmin}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${today} ${excludeAdmin}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${weekAgo} ${excludeAdmin}`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${monthAgo} ${excludeAdmin}`,
      prisma.$queryRaw<{ page_path: string; views: bigint }[]>`
        SELECT page_path, COUNT(*) as views
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${monthAgo}
          AND page_path NOT LIKE '/admin%' ${excludeAdmin}
        GROUP BY page_path ORDER BY views DESC LIMIT 10`,
      prisma.$queryRaw<{ country: string; count: bigint }[]>`
        SELECT country, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE country IS NOT NULL AND started_at >= ${monthAgo} ${excludeAdminSession}
        GROUP BY country ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw<{ language: string; count: bigint }[]>`
        SELECT language, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE language IS NOT NULL AND started_at >= ${monthAgo} ${excludeAdminSession}
        GROUP BY language ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw<{ referrer: string; count: bigint }[]>`
        SELECT referrer, COUNT(DISTINCT visitor_id) as count
        FROM analytics_sessions
        WHERE referrer IS NOT NULL AND referrer != '' AND started_at >= ${monthAgo} ${excludeAdminSession}
        GROUP BY referrer ORDER BY count DESC LIMIT 20`,
      prisma.$queryRaw<{ day: Date; views: bigint; visitors: bigint }[]>`
        SELECT
          DATE(created_at) as day,
          COUNT(*) as views,
          COUNT(DISTINCT visitor_id) as visitors
        FROM analytics_events
        WHERE event_type = 'page_view' AND created_at >= ${twoWeeksAgo} ${excludeAdmin}
        GROUP BY DATE(created_at)
        ORDER BY day ASC`,
      prisma.$queryRaw<{ search_query: string; page_path: string; created_at: Date }[]>`
        SELECT search_query, page_path, created_at
        FROM analytics_events
        WHERE event_type = 'search' AND search_query IS NOT NULL ${excludeAdmin}
        ORDER BY created_at DESC LIMIT 10`,
      prisma.$queryRaw<{ query: string; search_count: bigint }[]>`
        SELECT LOWER(search_query) as query, COUNT(*) as search_count
        FROM analytics_events
        WHERE event_type = 'search' AND search_query IS NOT NULL ${excludeAdmin}
        GROUP BY LOWER(search_query)
        ORDER BY search_count DESC LIMIT 15`,

      // -- Auctions --
      prisma.auction.count(),
      prisma.$queryRaw<{ auction_status: string; count: bigint }[]>`
        SELECT auction_status, COUNT(*) as count
        FROM auctions
        GROUP BY auction_status
        ORDER BY count DESC`,
      prisma.currentAuction.count({ where: { isActive: true } }),
      prisma.$queryRaw<{ avg_price: number }[]>`
        SELECT AVG(sold_price)::numeric as avg_price
        FROM auctions
        WHERE auction_status = 'sold' AND sold_price > 0`,
      prisma.$queryRaw<{ vocation: string; total: bigint; sold: bigint; avg_price: number }[]>`
        SELECT
          vocation,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE auction_status = 'sold') as sold,
          COALESCE(AVG(sold_price) FILTER (WHERE auction_status = 'sold' AND sold_price > 0), 0)::numeric as avg_price
        FROM auctions
        WHERE vocation IS NOT NULL
        GROUP BY vocation
        ORDER BY total DESC
        LIMIT 10`,
      prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM auctions
        WHERE created_at >= ${twoWeeksAgo}
        GROUP BY DATE(created_at)
        ORDER BY day ASC`,
      prisma.$queryRaw<{ world: string; count: bigint }[]>`
        SELECT world, COUNT(*) as count
        FROM current_auctions
        WHERE is_active = true AND world IS NOT NULL
        GROUP BY world
        ORDER BY count DESC
        LIMIT 15`,

      // -- Users --
      prisma.user.count(),
      prisma.user.count({ where: { premiumTier: { not: 'free' } } }),
      prisma.premiumRequest.count({ where: { status: 'pending' } }),
      prisma.user.findMany({
        select: {
          id: true, name: true, email: true, image: true,
          premiumTier: true, premiumSince: true, premiumUntil: true,
          isAdmin: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.premiumRequest.findMany({
        include: { user: { select: { name: true, email: true, image: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // -- Game Data --
      prisma.ban.count(),
      prisma.ban.count({ where: { isActive: true } }),
      prisma.transfer.count(),
      prisma.$queryRaw<{ from_world: string; to_world: string; count: bigint }[]>`
        SELECT from_world, to_world, COUNT(*) as count
        FROM transfers
        GROUP BY from_world, to_world
        ORDER BY count DESC
        LIMIT 15`,

      // -- Community --
      prisma.featureRequest.count(),
      prisma.feedback.count(),
      prisma.itemListing.count({ where: { isActive: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        traffic: {
          overview: {
            totalVisitors: Number(totalVisitorsRaw[0]?.count || 0),
            totalSessions: Number(totalSessionsRaw[0]?.count || 0),
            visitorsToday: Number(visitorsTodayRaw[0]?.count || 0),
            visitorsWeek: Number(visitorsWeekRaw[0]?.count || 0),
            visitorsMonth: Number(visitorsMonthRaw[0]?.count || 0),
            pageViewsToday: Number(pageViewsTodayRaw[0]?.count || 0),
            pageViewsWeek: Number(pageViewsWeekRaw[0]?.count || 0),
            pageViewsMonth: Number(pageViewsMonthRaw[0]?.count || 0),
          },
          topPages: topPagesRaw.map(r => ({ path: r.page_path, views: Number(r.views) })),
          countries: countriesRaw.map(r => ({ country: r.country, visitors: Number(r.count) })),
          languages: languagesRaw.map(r => ({ language: r.language, visitors: Number(r.count) })),
          referrers: referrersRaw.map(r => ({ referrer: r.referrer, visitors: Number(r.count) })),
          daily: dailyTrafficRaw.map(r => ({
            day: r.day.toISOString().split('T')[0],
            views: Number(r.views),
            visitors: Number(r.visitors),
          })),
          recentSearches: recentSearchesRaw.map(r => ({
            query: r.search_query,
            pagePath: r.page_path,
            createdAt: r.created_at.toISOString(),
          })),
          topSearches: topSearchesRaw.map(r => ({
            query: r.query,
            count: Number(r.search_count),
          })),
        },
        auctions: {
          total: totalAuctions,
          active: activeAuctions,
          statusBreakdown: auctionStatusRaw.map(r => ({ status: r.auction_status, count: Number(r.count) })),
          avgSoldPrice: Math.round(Number(avgSoldPrice[0]?.avg_price || 0)),
          vocationBreakdown: vocationBreakdownRaw.map(r => ({
            vocation: r.vocation,
            total: Number(r.total),
            sold: Number(r.sold),
            avgPrice: Math.round(Number(r.avg_price)),
          })),
          dailyNew: dailyAuctionsRaw.map(r => ({
            day: r.day.toISOString().split('T')[0],
            count: Number(r.count),
          })),
          worldDistribution: worldDistributionRaw.map(r => ({
            world: r.world,
            count: Number(r.count),
          })),
        },
        users: {
          total: totalUsers,
          premium: premiumUsers,
          pendingRequests,
          userList: userListRaw.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image,
            premiumTier: u.premiumTier,
            premiumSince: u.premiumSince?.toISOString() || null,
            premiumUntil: u.premiumUntil?.toISOString() || null,
            isAdmin: u.isAdmin,
            createdAt: u.createdAt.toISOString(),
          })),
          premiumRequests: premiumRequestsRaw.map(r => ({
            id: r.id,
            characterName: r.characterName,
            requestedTier: r.requestedTier,
            rcAmount: r.rcAmount,
            transactionDate: r.transactionDate?.toISOString() || null,
            status: r.status,
            adminNote: r.adminNote,
            reviewedAt: r.reviewedAt?.toISOString() || null,
            createdAt: r.createdAt.toISOString(),
            user: r.user,
          })),
        },
        gameData: {
          totalBans,
          activeBans,
          totalTransfers,
          topTransferRoutes: recentTransfersRaw.map(r => ({
            from: r.from_world,
            to: r.to_world,
            count: Number(r.count),
          })),
        },
        community: {
          featureRequests: totalFeatureRequests,
          feedback: totalFeedback,
          activeListings: totalListings,
        },
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
