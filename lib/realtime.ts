/**
 * Real-time subscription helpers
 * --------------------------------------------
 * Thin wrappers around Supabase Realtime channels with auto-cleanup.
 * Used for: leaderboard updates, team feed live posts, notification badge.
 *
 * Each helper returns an unsubscribe function.
 */

import { useEffect } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Unsubscribe = () => void;

/** Subscribe to changes on a table. Returns unsubscribe fn. */
export function subscribeTable(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  onChange: (payload: any) => void,
  filter?: string,
): Unsubscribe {
  // Supabase Realtime requires filter in the form "col=in.(a,b,c)" or "col=eq.value"
  // If filter is just an array of IDs, format it as "col=in.(...)"
  let finalFilter = filter;
  if (Array.isArray(filter)) {
    if (filter.length === 0) {
      // No IDs to subscribe to — return a no-op unsub
      return () => {};
    }
    // Caller passes column + array; we format here
    const [col, ...rest] = arguments[3] as any; // not used
  }
  const channel: RealtimeChannel = supabase
    .channel(`rt:${table}:${event}:${filter || 'all'}:${Date.now()}`)
    .on(
      'postgres_changes' as any,
      { event, schema: 'public', table, filter: finalFilter } as any,
      (payload: any) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Subscribe to a table filtered by a list of IDs on a specific column. */
export function subscribeTableIn(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  column: string,
  ids: string[],
  onChange: (payload: any) => void,
): Unsubscribe {
  if (ids.length === 0) return () => {};
  const filter = `${column}=in.(${ids.join(',')})`;
  return subscribeTable(table, event, onChange, filter);
}

/** React hook: subscribe on mount, unsubscribe on unmount. */
export function useRealtimeTable(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  onChange: (payload: any) => void,
  filter?: string,
  deps: any[] = [],
) {
  useEffect(() => {
    const unsub = subscribeTable(table, event, onChange, filter);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** React hook: subscribe filtered by `column IN (ids)`. No-op if ids is empty. */
export function useRealtimeTableIn(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  column: string,
  ids: string[],
  onChange: (payload: any) => void,
  deps: any[] = [],
) {
  useEffect(() => {
    if (ids.length === 0) return;
    const filter = `${column}=in.(${ids.join(',')})`;
    const unsub = subscribeTable(table, event, onChange, filter);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
