'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';

const SEEN_KEY = 'discipline.lastSeenNotifications.v1';

type Counts = {
  reports: number;
  community: number;
  team: number;
};

export function NotificationBell({ userId }: { userId: string | null }) {
  const toast = useToast();
  const [counts, setCounts] = useState<Counts>({ reports: 0, community: 0, team: 0 });
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);

  const recompute = useCallback(async () => {
    if (!userId) return;
    const lastSeen = (() => {
      try { return localStorage.getItem(SEEN_KEY) || new Date(0).toISOString(); } catch { return new Date(0).toISOString(); }
    })();

    try {
      // Load team memberships in parallel with counts
      const [{ data: reports }, { data: community }, { data: memberships }] = await Promise.all([
        supabase.from('reports').select('id, created_at').gt('created_at', lastSeen),
        supabase.from('community_posts').select('id, created_at').gt('created_at', lastSeen),
        supabase.from('team_members').select('team_id').eq('user_id', userId),
      ]);

      const teamIds = (memberships || []).map((m: any) => m.team_id);
      setMyTeamIds(teamIds);

      let teamCount = 0;
      if (teamIds.length > 0) {
        const { count } = await supabase
          .from('team_startup_log')
          .select('*', { count: 'exact', head: true })
          .in('team_id', teamIds)
          .gt('created_at', lastSeen);
        teamCount = count || 0;
      }

      setCounts({
        reports: reports?.length || 0,
        community: community?.length || 0,
        team: teamCount,
      });
    } catch (e) {
      // silent — count badge is non-critical
    }
  }, [userId]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // Initial load
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Real-time: when a new report / community post / team log appears, refresh counts
  useEffect(() => {
    if (!userId) return;

    const reportsChannel = supabase
      .channel(`bell:reports`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'reports' }, () => recompute())
      .subscribe();

    const communityChannel = supabase
      .channel(`bell:community`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'community_posts' }, () => recompute())
      .subscribe();

    // Team log channel — only subscribe once we know which teams the user is in
    let teamChannel: any = null;
    const setupTeamChannel = async () => {
      const { data: memberships } = await supabase.from('team_members').select('team_id').eq('user_id', userId);
      const teamIds = (memberships || []).map((m: any) => m.team_id);
      if (teamIds.length === 0) return;
      teamChannel = supabase
        .channel(`bell:team_log`)
        .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'team_startup_log', filter: `team_id=in.(${teamIds.join(',')})` }, () => recompute())
        .subscribe();
    };
    setupTeamChannel();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(communityChannel);
      if (teamChannel) supabase.removeChannel(teamChannel);
    };
  }, [userId, myTeamIds, recompute]);

  const total = counts.reports + counts.community + counts.team;

  const markAllSeen = () => {
    try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch {}
    setCounts({ reports: 0, community: 0, team: 0 });
  };

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success('Reminders enabled');
      } else {
        toast.info('Reminders blocked — enable in browser settings');
      }
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={() => { markAllSeen(); requestPermission(); }}
        className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors relative"
        aria-label={`Notifications${total > 0 ? ` (${total} new)` : ''}`}
        title={permission === 'granted' ? `${total} new updates` : 'Click to enable reminders'}
      >
        <Bell className="w-4 h-4 text-neutral-300" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-amber-400 text-black text-[10px] font-extrabold flex items-center justify-center px-1">
            {total > 9 ? '9+' : total}
          </span>
        )}
        {permission !== 'granted' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-[#0D0D0D]" />
        )}
      </button>

      {total > 0 && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-neutral-800 bg-[#121212] shadow-2xl p-3 z-50 hidden group-hover:block">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-2">New since your last visit</p>
          {counts.reports > 0 && (
            <Link href="/reports" onClick={markAllSeen} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-900 text-sm text-neutral-200">
              <span>New reports</span>
              <span className="text-amber-300 font-extrabold">{counts.reports}</span>
            </Link>
          )}
          {counts.community > 0 && (
            <Link href="/community" onClick={markAllSeen} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-900 text-sm text-neutral-200">
              <span>Announcements</span>
              <span className="text-amber-300 font-extrabold">{counts.community}</span>
            </Link>
          )}
          {counts.team > 0 && (
            <Link href="/team" onClick={markAllSeen} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-neutral-900 text-sm text-neutral-200">
              <span>Team updates</span>
              <span className="text-amber-300 font-extrabold">{counts.team}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
