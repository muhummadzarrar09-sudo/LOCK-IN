'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeEvent } from './CohortRealtime';
import { useToast } from './Toast';
import { initials, relativeTime } from '@/lib/ui';
import { FreshnessDot } from './FreshnessDot';

type LogEntry = {
  id: string;
  team_id: string;
  user_id: string;
  note: string;
  created_at: string;
  username?: string;
};

type Props = {
  userId: string;
  teamIds: string[];
  teamName?: string;
};

/**
 * Compact "team pulse" card for the dashboard. Shows the latest 2 team feed
 * entries. Surfaces a toast when a teammate posts in real time. Only renders
 * if the user is on at least one team.
 */
export function DashboardTeamPulse({ userId, teamIds, teamName }: Props) {
  const toast = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useState(() => new Set<string>())[0];

  const load = useCallback(async () => {
    if (teamIds.length === 0) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('team_startup_log')
      .select('id, team_id, user_id, note, created_at')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false })
      .limit(2);
    if (data) {
      const ids = [...new Set((data as any[]).map((l) => l.user_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, username')
          .in('id', ids);
        const pmap = new Map((profiles || []).map((p: any) => [p.id, p.username]));
        const enriched = (data as any[]).map((l) => ({ ...l, username: pmap.get(l.user_id) }));
        setLogs(enriched);
        enriched.forEach((l) => seenIdsRef.add(l.id));
      } else {
        setLogs(data as any[]);
      }
    }
    setLoading(false);
  }, [teamIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Real-time: refresh team feed when teammates post. The toast fan-out
  // for new team posts is handled by GlobalRealtimeToaster (single shared
  // channel via CohortRealtimeProvider) — we just listen for the event
  // here to refresh the list.
  useRealtimeEvent('team', () => load(), teamIds.length > 0);

  if (teamIds.length === 0) return null;
  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <section className="mt-6 mb-2 rounded-2xl border border-amber-900/30 bg-gradient-to-br from-amber-950/15 to-transparent p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <h2 className="text-[10px] font-extrabold text-amber-200/80 uppercase tracking-[0.2em] truncate">
            {teamName ? `${teamName} · recent` : 'Team · recent'}
          </h2>
        </div>
        <Link
          href="/team"
          className="text-[10px] text-amber-300 hover:text-amber-200 font-bold uppercase tracking-wider inline-flex items-center gap-1 shrink-0"
        >
          All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2.5">
        {logs.map((entry) => {
          const who = entry.username || 'Member';
          const isYou = entry.user_id === userId;
          return (
            <div key={entry.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-700/30 flex items-center justify-center text-[9px] font-extrabold text-amber-300 shrink-0">
                {initials(who)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-neutral-200">
                  <span className="font-extrabold text-white">
                    {isYou ? 'You' : who}
                  </span>
                  {' '}
                  <span className="text-neutral-400">{entry.note}</span>
                </p>
                <p className="text-[10px] text-neutral-600 inline-flex items-center gap-1.5 mt-0.5">
                  <FreshnessDot iso={entry.created_at} />
                  <Clock className="w-2.5 h-2.5" />
                  {relativeTime(entry.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
