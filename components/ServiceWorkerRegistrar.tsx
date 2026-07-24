'use client';
import { useEffect } from 'react';

/** Registers the offline-capable service worker. No-op in dev (Next dev server has its own SW). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Only register in production to avoid Next dev's HMR conflicts.
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Optional: check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              console.info('[sw] New version available, will activate on next load.');
            }
          });
        });
      })
      .catch((err) => console.warn('[sw] registration failed:', err));
  }, []);
  return null;
}
