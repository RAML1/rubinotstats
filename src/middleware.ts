import { NextRequest, NextResponse } from 'next/server';

const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

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
// Middleware
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  // Allow NextAuth routes through without Basic Auth
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/auth')) {
    const response = NextResponse.next();
    setAnalyticsCookies(request, response);
    return response;
  }

  if (!AUTH_USER || !AUTH_PASS) {
    return new NextResponse('Server misconfigured', { status: 503 });
  }

  // Check Authorization header first (initial page load / API tools)
  const authHeader = request.headers.get('authorization');
  let authenticated = false;

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === AUTH_USER && pass === AUTH_PASS) {
        authenticated = true;
      }
    }
  }

  // Allow through if the user already authenticated (has session cookie).
  // Browser fetch/XHR calls don't re-send Basic Auth, but they do send cookies.
  if (!authenticated && request.cookies.get(SESSION_COOKIE)) {
    authenticated = true;
  }

  if (!authenticated) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="RubinOT Stats"',
      },
    });
  }

  // Rate-limit API routes only (not pages)
  if (pathname.startsWith('/api/')) {
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
  }

  const response = NextResponse.next();
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
