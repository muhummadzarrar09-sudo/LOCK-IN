'use client';
import { useEffect, useState } from 'react';

/** Returns current time as "HH:MM" string, updated every `intervalMs`. */
export function useCurrentTime(intervalMs = 60_000): string {
  // Initialize lazily from formatNow() — no need to sync in an effect.
  const [now, setNow] = useState<string>(formatNow);

  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function formatNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** True if `now` (HH:MM) is within [start, end] inclusive. Handles overnight wrap. */
export function isWithin(now: string, start: string, end: string): boolean {
  if (!now || !start || !end) return false;
  if (start === end) return false;
  if (start < end) return now >= start && now < end;
  // overnight (e.g. 22:00 → 06:00)
  return now >= start || now < end;
}

/** Parse "HH:MM" → minutes since midnight. */
export function toMinutes(t: string): number {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
