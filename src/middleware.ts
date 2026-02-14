import { NextRequest, NextResponse } from 'next/server';

const AUTH_USER = process.env.AUTH_USER;
const AUTH_PASS = process.env.AUTH_PASS;

const VISITOR_COOKIE = '_rs_vid';
const SESSION_COOKIE = '_rs_sid';
const VISITOR_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const SESSION_MAX_AGE = 30 * 60; // 30 minutes

export function middleware(request: NextRequest) {
  if (!AUTH_USER || !AUTH_PASS) {
    return new NextResponse('Server misconfigured', { status: 503 });
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === AUTH_USER && pass === AUTH_PASS) {
        const response = NextResponse.next();
        setAnalyticsCookies(request, response);
        return response;
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="RubinOT Stats"',
    },
  });
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
