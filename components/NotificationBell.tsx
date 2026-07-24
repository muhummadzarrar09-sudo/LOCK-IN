'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, FileText, MessageCircle, MessageSquare, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { relativeTime } from '@/lib/ui';

const SEEN_KEY = 'discipline.lastSeenNotifications.v1';

type Activity = {
  id: string;
  type: 'report' | 'community' | 'team';
  title: string;
  snippet: string;
  created_at: string;
  href: string;
};

export function NotificationBell({ userId }: { userId: string | null }) {
  const toast = useToast();
  const [items, setItems] = useState<Activity[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [open, setOpen] = useState(false);

  const recompute = useCallback(async () => {
    if (!userId) return;
    const lastSeen = (() => {
      try { return localStorage.getItem(SEEN_KEY) || new Date(0).toISOString(); } catch { return new Date(0).toISOString(); }
    })();

    try {
      const [{ data: reports }, { data: community }, { data: memberships }] = await Promise.all([
        supabase
          .from('reports')
          .select('id, title, body, created_at')
          .gt('created_at', lastSeen)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('community_posts')
          .select('id, title, body, created_at')
          .gt('created_at', lastSeen)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('team_members').select('team_id').eq('user_id', userId),
      ]);

      const teamIds = (memberships || []).map((m: any) => m.team_id);
      let teamRows: any[] = [];
      if (teamIds.length > 0) {
        const { data } = await supabase
          .from('team_startup_log')
          .select('id, note, created_at, user_id')
          .in('team_id', teamIds)
          .gt('created_at', lastSeen)
          .order('created_at', { ascending: false })
          .limit(5);
        teamRows = (data || []);
        // Hydrate usernames
        if (teamRows.length > 0) {
          const userIds = [...new Set(teamRows.map((t) => t.user_id))];
          const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
          const pmap = new Map((profiles || []).map((p: any) => [p.id, p.username]));
          teamRows = teamRows.map((t) => ({ ...t, username: pmap.get(t.user_id) || 'Member' }));
        }
      }

      const next: Activity[] = [
        ...(reports || []).map((r: any) => ({
          id: r.id,
          type: 'report' as const,
          title: r.title,
          snippet: (r.body || '').slice(0, 80),
          created_at: r.created_at,
          href: '/reports',
        })),
        ...(community || []).map((p: any) => ({
          id: p.id,
          type: 'community' as const,
          title: p.title,
          snippet: (p.body || '').slice(0, 80),
          created_at: p.created_at,
          href: '/community',
        })),
        ...teamRows.map((t: any) => ({
          id: t.id,
          type: 'team' as const,
          title: `${t.username || 'Teammate'} posted`,
          snippet: (t.note || '').slice(0, 80),
          created_at: t.created_at,
          href: '/team',
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12);

      setItems(next);
    } catch (e) {
      // silent
    }
  }, [userId]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    recompute();
  }, [recompute]);

  // Real-time: when a new report / community post / team log appears, refresh
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
  }, [userId, recompute]);

  const total = items.length;

  const markAllSeen = () => {
    try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch {}
    setItems([]);
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

  const handleClick = () => {
    setOpen((v) => !v);
    requestPermission();
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
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

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Notifications"
            className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-neutral-800 bg-[#121212] shadow-2xl p-2 z-50 fade-in-up"
          >
            <div className="flex items-center justify-between px-2 py-1.5 sticky top-0 bg-[#121212] border-b border-neutral-900 mb-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
                {total > 0 ? `${total} new update${total === 1 ? '' : 's'}` : 'No new updates'}
              </p>
              {total > 0 && (
                <button
                  onClick={markAllSeen}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 hover:text-amber-200"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
            {total === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-neutral-500">
                <Bell className="w-5 h-5 text-neutral-700 mx-auto mb-2" />
                You&apos;re all caught up.
              </div>
            ) : (
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={`${it.type}-${it.id}`}>
                    <Link
                      href={it.href}
                      onClick={() => { markAllSeen(); setOpen(false); }}
                      className="flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-neutral-900/60 transition-colors"
                    >
                      <div className="shrink-0 w-7 h-7 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center mt-0.5">
                        {it.type === 'report' && <FileText className="w-3.5 h-3.5 text-amber-300" />}
                        {it.type === 'community' && <MessageCircle className="w-3.5 h-3.5 text-violet-300" />}
                        {it.type === 'team' && <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-extrabold text-amber-100 truncate">{it.title}</p>
                          <span className="shrink-0 text-[9px] text-neutral-500 font-mono">{relativeTime(it.created_at)}</span>
                        </div>
                        {it.snippet && (
                          <p
                            className="text-[10px] text-neutral-400 mt-0.5 leading-snug"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {it.snippet}
                          </p>
                        )}
                        <p className="text-[9px] uppercase tracking-wider text-neutral-600 font-bold mt-1">
                          {it.type === 'report' ? 'Report' : it.type === 'community' ? 'Announcement' : 'Team update'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
