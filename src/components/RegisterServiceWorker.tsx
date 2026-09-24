'use client';

import { useEffect } from 'react';

/** Registers the passthrough service worker so browsers offer "Add to Home Screen" /
 * "Install app" (Chrome/Android needs a fetch-handling service worker for installability;
 * iOS Safari doesn't require one but this doesn't hurt there either). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
  }, []);
  return null;
}
