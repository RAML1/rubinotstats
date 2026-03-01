import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const VISITOR_COOKIE = '_rs_vid';
const SESSION_COOKIE = '_rs_sid';
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const SESSION_MAX_AGE = 30 * 60; // 30 minutes

// ---------------------------------------------------------------------------
// In-memory rate limiter (per-IP, sliding window)
// ---------------------------------------------------------------------------
interface RateEntry {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  rateBuckets.forEach((entry, key) => {
    if (now > entry.resetAt) rateBuckets.delete(key);
  });
}

function checkRateLimit(
  ip: string,
  pathname: string,
): { limited: boolean; retryAfter: number } {
  cleanupStaleEntries();

  let maxRequests: number;
  let windowMs: number;

  if (pathname.startsWith('/api/cron')) {
    maxRequests = 5;
    windowMs = 5 * 60 * 1000; // 5 min
  } else if (pathname.startsWith('/api/admin')) {
    maxRequests = 30;
    windowMs = 60 * 1000; // 1 min
  } else {
    maxRequests = 60;
    windowMs = 60 * 1000; // 1 min
  }

  const key = `${ip}:${pathname.startsWith('/api/cron') ? 'cron' : pathname.startsWith('/api/admin') ? 'admin' : 'api'}`;
  const now = Date.now();
  const entry = rateBuckets.get(key);

  if (!entry || now > entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// API origin guard — block external tools/scripts from hitting /api/* routes
// ---------------------------------------------------------------------------
const ALLOWED_HOSTS = new Set([
  'rubinotstats.com',
  'www.rubinotstats.com',
  'rubinotstats-web-production.up.railway.app',
  'localhost:3000',
  'localhost:3001',
]);

function isAllowedOrigin(request: NextRequest): boolean {
  // Check Origin header (sent on fetch/XHR from browsers)
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      return ALLOWED_HOSTS.has(url.host);
    } catch {
      return false;
    }
  }

  // Check Referer header (sent on navigation and some fetches)
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      return ALLOWED_HOSTS.has(url.host);
    } catch {
      return false;
    }
  }

  // No Origin or Referer = external tool (curl, scripts, Postman)
  return false;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow NextAuth routes through directly
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/auth')) {
    const response = NextResponse.next();
    setAnalyticsCookies(request, response);
    return response;
  }

  // --- API-specific protections ---
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/cron') && request.headers.get('x-cron-secret')) {
      const response = NextResponse.next();
      return response;
    }

    // Public read-only endpoints — skip origin guard
    if (pathname === '/api/boosted') {
      const response = NextResponse.next();
      setAnalyticsCookies(request, response);
      return response;
    }

    if (!isAllowedOrigin(request)) {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('cf-connecting-ip') ||
      'unknown';

    const { limited, retryAfter } = checkRateLimit(ip, pathname);
    if (limited) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
          },
        },
      );
    }

    const response = NextResponse.next();
    setAnalyticsCookies(request, response);
    return response;
  }

  // Admin routes — pass through without locale handling
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    setAnalyticsCookies(request, response);
    return response;
  }

  // User-facing routes — handle locale detection/redirect
  const response = intlMiddleware(request);
  setAnalyticsCookies(request, response);
  return response;
}

function setAnalyticsCookies(request: NextRequest, response: NextResponse) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Visitor cookie — persistent, 1 year
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: VISITOR_MAX_AGE,
      path: '/',
    });
  }

  // Session cookie — sliding, 30 min (refresh on every request)
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  response.cookies.set(SESSION_COOKIE, existingSession || crypto.randomUUID(), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico|.*\\.jpg|.*\\.png|.*\\.svg|.*\\.webp).*)'],
};
