'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Flame, Target, MessageSquare, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeEvent } from './CohortRealtime';

type Props = {
  teamId: string;
  memberUserIds: string[];
};

type Stats = {
  avgStreak: number;
  bestStreak: number;
  totalCheckInsWeek: number;
  totalPosts: number;
};

/**
 * Compact stats strip for the team page. Shows collective momentum:
 * average streak, best streak, weekly check-ins, total team feed
 * posts. Reads existing data (streaks, check_ins, team_startup_log)
 * — no new schema. Real-time refreshes when teammates check in.
 */
export function TeamPulseStats({ teamId, memberUserIds }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const teamIdRef = useRef(teamId);
  teamIdRef.current = teamId;
  const memberIdsRef = useRef(memberUserIds);
  memberIdsRef.current = memberUserIds;

  const load = useCallback(async () => {
    const ids = memberIdsRef.current;
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();

      const [{ data: streaks }, { count: weekCount }, { count: postCount }] = await Promise.all([
        supabase
          .from('streaks')
          .select('current_streak, best_streak')
          .in('user_id', ids),
        supabase
          .from('check_ins')
          .select('*', { count: 'exact', head: true })
          .in('user_id', ids)
          .gte('completed_at', sinceISO),
        supabase
          .from('team_startup_log')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamIdRef.current),
      ]);
      const streaksList = (streaks || []) as any[];
      const avg = streaksList.length
        ? Math.round((streaksList.reduce((s, x) => s + (x.current_streak || 0), 0) / streaksList.length) * 10) / 10
        : 0;
      const best = streaksList.reduce((m, x) => Math.max(m, x.best_streak || 0), 0);
      setStats({
        avgStreak: avg,
        bestStreak: best,
        totalCheckInsWeek: weekCount || 0,
        totalPosts: postCount || 0,
      });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: refresh when any team member posts (single shared channel
  // via CohortRealtimeProvider). We no longer subscribe to all check_ins
  // events (which previously meant N concurrent subscriptions per N
  // teams — a real perf issue on the free tier).
  useRealtimeEvent('team', () => load(), memberUserIds.length > 0);

  if (loading || !stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
      <Stat
        icon={<Flame className="w-3 h-3 text-amber-400" />}
        label="Team avg streak"
        value={`${stats.avgStreak}d`}
      />
      <Stat
        icon={<Trophy className="w-3 h-3 text-amber-400" />}
        label="Team best"
        value={`${stats.bestStreak}d`}
      />
      <Stat
        icon={<Target className="w-3 h-3 text-emerald-400" />}
        label="Check-ins · 7d"
        value={String(stats.totalCheckInsWeek)}
      />
      <Stat
        icon={<MessageSquare className="w-3 h-3 text-violet-400" />}
        label="Feed posts"
        value={String(stats.totalPosts)}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold truncate">{label}</span>
      </div>
      <p className="text-base font-black text-amber-100 leading-none">{value}</p>
    </div>
  );
}
