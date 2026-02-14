import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface AnalyticsPayload {
  eventType: 'page_view' | 'search';
  pagePath: string;
  referrer?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  searchQuery?: string;
}

export async function POST(request: NextRequest) {
  try {
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

    // Upsert session (create if new, update lastSeenAt if existing)
    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        userAgent: userAgent?.substring(0, 500),
        referrer: body.referrer?.substring(0, 500),
      },
      update: {
        lastSeenAt: new Date(),
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
