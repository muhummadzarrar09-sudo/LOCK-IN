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
  const channel: RealtimeChannel = supabase
    .channel(`rt:${table}:${event}:${Date.now()}`)
    .on(
      'postgres_changes' as any,
      { event, schema: 'public', table, filter } as any,
      (payload: any) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
