'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { useRealtimeContext } from './CohortRealtime';

/**
 * App-wide toast fan-out. Subscribes to the shared realtime channels
 * (opened by CohortRealtimeProvider) and shows a short info toast
 * for every cohort event. No more local Supabase channels here.
 */
export function GlobalRealtimeToaster() {
  const toast = useToast();
  const seenRef = useRef<Set<string>>(new Set());
  const { userId } = useRealtimeContext();
  const seenSelfRef = useRef<Set<string>>(new Set());

  // Hydrate "seen self" set so we don't toast about our own posts
  // even on the first session after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('discipline.seenSelfPosts.v1');
      if (raw) seenSelfRef.current = new Set(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const markSelf = (id: string) => {
    seenSelfRef.current.add(id);
    if (typeof window !== 'undefined') {
      try { sessionStorage.setItem('discipline.seenSelfPosts.v1', JSON.stringify([...seenSelfRef.current])); } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: myRecent } = await supabase
        .from('team_startup_log')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      (myRecent || []).forEach((r: any) => seenSelfRef.current.add(r.id));
    })();
  }, [userId]);

  // On every shared event, fire a toast
  useRealtimeContext_userId_safe_event('report', (payload: any) => {
    const row = payload?.new;
    if (!row) return;
    if (seenRef.current.has(`report-${row.id}`)) return;
    seenRef.current.add(`report-${row.id}`);
    toast.info(`New report: ${row.title}`);
  });
  useRealtimeContext_userId_safe_event('community', (payload: any) => {
    const row = payload?.new;
    if (!row) return;
    if (seenRef.current.has(`community-${row.id}`)) return;
    seenRef.current.add(`community-${row.id}`);
    toast.info(`New announcement: ${row.title}`);
  });
  useRealtimeContext_userId_safe_event('team', async (payload: any) => {
    const row = payload?.new;
    if (!row) return;
    if (seenRef.current.has(`team-${row.id}`)) return;
    seenRef.current.add(`team-${row.id}`);
    if (row.user_id === userId || seenSelfRef.current.has(row.id)) {
      markSelf(row.id);
      return;
    }
    const { data: prof } = await supabase.from('public_profiles').select('username').eq('id', row.user_id).maybeSingle();
    const who = (prof as any)?.username || 'A teammate';
    toast.info(`${who} just shipped an update`);
  });

  return null;
}

// Wrapper hook to avoid TS issues with the conditional enabled param
import { useRealtimeEvent } from './CohortRealtime';
function useRealtimeContext_userId_safe_event(type: 'report' | 'community' | 'team', cb: (payload: any) => void) {
  useRealtimeEvent(type, cb);
}
