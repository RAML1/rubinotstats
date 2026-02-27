import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

interface AnalyticsPayload {
  eventType: 'page_view' | 'search';
  pagePath: string;
  referrer?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  searchQuery?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Skip tracking for admin users
    const session = await getServerSession(authOptions);
    if (session?.user?.isAdmin) {
      return NextResponse.json({ success: true });
    }

    const visitorId = request.cookies.get('_rs_vid')?.value;
    const sessionId = request.cookies.get('_rs_sid')?.value;

    if (!visitorId || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing analytics cookies' },
        { status: 400 }
      );
    }

    const body: AnalyticsPayload = await request.json();

    if (!body.eventType || !body.pagePath) {
      return NextResponse.json(
        { success: false, error: 'eventType and pagePath are required' },
        { status: 400 }
      );
    }

    if (!['page_view', 'search'].includes(body.eventType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid eventType' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;

    // Geo detection from reverse proxy / Railway headers
    const country =
      request.headers.get('cf-ipcountry') ||          // Cloudflare
      request.headers.get('x-vercel-ip-country') ||    // Vercel
      request.headers.get('x-country') ||              // Generic proxy
      undefined;

    const language =
      body.language?.substring(0, 50) ||
      request.headers.get('accept-language')?.split(',')[0]?.substring(0, 50) ||
      undefined;

    // Upsert session (create if new, update lastSeenAt if existing)
    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        userAgent: userAgent?.substring(0, 500),
        referrer: body.referrer?.substring(0, 500),
        country: country?.substring(0, 10),
        language,
      },
      update: {
        lastSeenAt: new Date(),
        ...(country ? { country: country.substring(0, 10) } : {}),
      },
    });

    // Insert event
    await prisma.analyticsEvent.create({
      data: {
        sessionId,
        visitorId,
        eventType: body.eventType,
        pagePath: body.pagePath.substring(0, 500),
        referrer: body.referrer?.substring(0, 500),
        viewportWidth: body.viewportWidth,
        viewportHeight: body.viewportHeight,
        searchQuery:
          body.eventType === 'search'
            ? body.searchQuery?.substring(0, 255)
            : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
