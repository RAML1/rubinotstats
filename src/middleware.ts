import { NextRequest, NextResponse } from 'next/server';

const AUTH_USER = process.env.AUTH_USER || 'danielesgay';
const AUTH_PASS = process.env.AUTH_PASS || 'danielesmuygay';

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === AUTH_USER && pass === AUTH_PASS) {
        return NextResponse.next();
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
