'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';

/**
 * Global real-time toaster. Subscribes to three event sources:
 * - reports (new admin-publish)
 * - community_posts (new admin announcement)
 * - team_startup_log (filtered to teams the user is in)
 *
 * On each event, shows a short info toast. Skips the initial
 * pre-existing rows so the user isn't bombarded on first load.
 */
export function GlobalRealtimeToaster() {
  const toast = useToast();
  const seenRef = useRef<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve userId from session
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

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let teamChannel: ReturnType<typeof supabase.channel> | null = null;

    const skip = (id: string) => {
      if (seenRef.current.has(id)) return true;
      seenRef.current.add(id);
      return false;
    };

    const reportsCh = supabase
      .channel('global:reports')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'reports' }, (payload: any) => {
        if (!mounted) return;
        const row = payload.new;
        if (!row || skip(`report-${row.id}`)) return;
        toast.info(`New report: ${row.title}`);
      })
      .subscribe();

    const communityCh = supabase
      .channel('global:community')
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'community_posts' }, (payload: any) => {
        if (!mounted) return;
        const row = payload.new;
        if (!row || skip(`community-${row.id}`)) return;
        toast.info(`New announcement: ${row.title}`);
      })
      .subscribe();

    // Team log: subscribe once we know the user's team IDs
    (async () => {
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('user_id', userId);
      const teamIds = (memberships || []).map((m: any) => m.team_id);
      if (teamIds.length === 0) return;
      teamChannel = supabase
        .channel('global:team_log')
        .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'team_startup_log', filter: `team_id=in.(${teamIds.join(',')})` }, async (payload: any) => {
          if (!mounted) return;
          const row = payload.new;
          if (!row || skip(`team-${row.id}`)) return;
          if (row.user_id === userId) return; // skip self
          const { data: prof } = await supabase.from('profiles').select('username').eq('id', row.user_id).maybeSingle();
          const who = (prof as any)?.username || 'A teammate';
          toast.info(`${who} just shipped an update`);
        })
        .subscribe();
    })();

    return () => {
      mounted = false;
      supabase.removeChannel(reportsCh);
      supabase.removeChannel(communityCh);
      if (teamChannel) supabase.removeChannel(teamChannel);
    };
  }, [userId, toast]);

  return null;
}
