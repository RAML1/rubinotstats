'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

function sendEvent(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      '/api/analytics',
      new Blob([body], { type: 'application/json' })
    );
  } else {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lastPath = useRef('');

  useEffect(() => {
    // Skip tracking for admin users
    if (session?.user?.isAdmin) return;

    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    sendEvent({
      eventType: 'page_view',
      pagePath: pathname,
      referrer: document.referrer || undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language || undefined,
    });
  }, [pathname, session]);

  return null;
}

export function trackSearch(query: string, pagePath: string) {
  sendEvent({
    eventType: 'search',
    pagePath,
    searchQuery: query,
  });
}
