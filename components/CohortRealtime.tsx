'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Cohort-wide realtime context. Opens ONE channel per event source
 * (reports, community_posts, team_startup_log) and fans out updates
 * to every subscribed component via a pub/sub pattern.
 *
 * Why this exists: NotificationBell, GlobalRealtimeToaster, and the
 * team-page feed were each opening their own identical channels,
 * which meant a busy cohort could fan out 9+ Supabase Realtime
 * connections per user. This consolidates to exactly 1 per event
 * source (or 1 for team_startup_log filtered to the user's teams).
 *
 * Components subscribe with `useRealtimeEvent('report' | 'community' | 'team', cb)`.
 * The context calls back every listener on every event.
 */

type EventType = 'report' | 'community' | 'team';
type Listener = (payload: any) => void;

type Ctx = {
  subscribe: (type: EventType, fn: Listener) => () => void;
  userId: string | null;
};

const RealtimeContext = createContext<Ctx>({
  subscribe: () => () => {},
  userId: null,
});

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}

export function useRealtimeEvent(type: EventType, onEvent: Listener, enabled = true) {
  const { subscribe } = useRealtimeContext();
  useEffect(() => {
    if (!enabled) return;
    return subscribe(type, onEvent);
  }, [type, onEvent, enabled, subscribe]);
}

export function CohortRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const listenersRef = useRef<Map<EventType, Set<Listener>>>(new Map([
    ['report', new Set()],
    ['community', new Set()],
    ['team', new Set()],
  ]));

  const subscribe = useCallback((type: EventType, fn: Listener) => {
    const set = listenersRef.current.get(type);
    if (!set) return () => {};
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }, []);

  const fan = useCallback((type: EventType, payload: any) => {
    const set = listenersRef.current.get(type);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(payload); } catch { /* one listener failed, don't take down the rest */ }
    });
  }, []);

  // Resolve userId once
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) setUserId(session?.user?.id || null);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (mounted) setUserId(session?.user?.id || null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Single channel per source
  useEffect(() => {
    const reportsCh = supabase
      .channel('cohort:reports')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'reports' }, (payload: any) => {
        fan('report', payload);
      })
      .subscribe();

    const communityCh = supabase
      .channel('cohort:community')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'community_posts' }, (payload: any) => {
        fan('community', payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportsCh);
      supabase.removeChannel(communityCh);
    };
  }, [fan]);

  // Team log channel: only if user has team_ids
  useEffect(() => {
    if (!userId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId);
      const teamIds = (memberships || []).map((m: any) => m.team_id);
      if (teamIds.length === 0) return;
      channel = supabase
        .channel('cohort:team_log')
        .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'team_startup_log', filter: `team_id=in.(${teamIds.join(',')})` }, (payload: any) => {
          fan('team', payload);
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, fan]);

  return (
    <RealtimeContext.Provider value={{ subscribe, userId }}>
      {children}
    </RealtimeContext.Provider>
  );
}
