'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

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
  const lastPath = useRef('');

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    sendEvent({
      eventType: 'page_view',
      pagePath: pathname,
      referrer: document.referrer || undefined,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, [pathname]);

  return null;
}

export function trackSearch(query: string, pagePath: string) {
  sendEvent({
    eventType: 'search',
    pagePath,
    searchQuery: query,
  });
}
