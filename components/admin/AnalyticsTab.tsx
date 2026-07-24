"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { TrendingUp, Users, Activity, Download, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/Skeleton';

type DailyActive = { day: string; active_members: number; total_checkins: number };
type TopMember = { id: string; username: string; check_ins: number; current_streak: number; best_streak: number };
type TopPoster = { id: string; username: string; posts: number };
type CohortMetrics = {
  total_members: number;
  active_today: number;
  avg_streak: number;
  best_streak: number;
  median_streak: number;
  cohort_avg_blocks_per_day: number;
  total_check_ins: number;
  total_teams: number;
  total_reports: number;
  total_community_posts: number;
  total_achievements: number;
  total_streak_freezes: number;
  retention_by_day: { day: number; pct_active: number; pct_completed_full: number }[];
  top_members: TopMember[];
  top_posters: TopPoster[];
  needs_nudge: TopMember[]; // members with 0 check-ins in the last 3 days
};

export function AnalyticsTab() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CohortMetrics | null>(null);
  const [dailyActive, setDailyActive] = useState<DailyActive[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // Pull all stats in parallel
      const [
        { count: totalMembers },
        { data: streaksData },
        { data: profilesData },
        { data: checkInsData },
        { count: totalTeams },
        { count: totalReports },
        { count: totalCommunityPosts },
        { count: totalAchievements },
        { count: totalFreezes },
        { data: dailyActiveData },
        { data: allUsernames },
        { data: allTeamLog },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member'),
        supabase.from('streaks').select('current_streak, best_streak'),
        supabase.from('profiles').select('created_at').eq('role', 'member'),
        supabase.from('check_ins').select('user_id, completed_at'),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('community_posts').select('*', { count: 'exact', head: true }),
        supabase.from('achievements').select('*', { count: 'exact', head: true }),
        supabase.from('streak_freezes').select('*', { count: 'exact', head: true }),
        supabase.from('cohort_daily_active').select('*').limit(30),
        supabase.from('profiles').select('id, username').eq('role', 'member'),
        supabase.from('team_startup_log').select('user_id'),
      ]);

      // Compute stats
      const streaks = (streaksData || []) as any[];
      const checkIns = (checkInsData || []) as any[];
      const profiles = (profilesData || []) as any[];

      const todayISO = new Date().toISOString().slice(0, 10);
      const todayUsers = new Set(checkIns.filter((c) => c.completed_at?.slice(0, 10) === todayISO).map((c) => c.user_id));
      const avg = streaks.length ? streaks.reduce((s, x) => s + (x.current_streak || 0), 0) / streaks.length : 0;
      const best = streaks.reduce((m, x) => Math.max(m, x.best_streak || 0), 0);
      const sorted = [...streaks.map((s) => s.current_streak || 0)].sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

      // Average check-ins per active day per user
      const userDays = new Map<string, Set<string>>();
      checkIns.forEach((c) => {
        const day = c.completed_at?.slice(0, 10);
        if (!day) return;
        if (!userDays.has(c.user_id)) userDays.set(c.user_id, new Set());
        userDays.get(c.user_id)!.add(day);
      });
      const blocksPerDay = Array.from(userDays.values()).reduce((s, days) => s + days.size, 0) / Math.max(streaks.length, 1);

      // Retention curve: for each day 1..30, what % of members have at least 1 check-in
      const cohortStart = (() => {
        const earliest = profiles
          .map((p) => p.created_at)
          .filter(Boolean)
          .sort()[0];
        if (!earliest) return null;
        return new Date(earliest);
      })();
      const daysSinceStart = cohortStart
        ? Math.min(30, Math.floor((Date.now() - cohortStart.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : 1;

      const retention: { day: number; pct_active: number; pct_completed_full: number }[] = [];
      for (let d = 1; d <= Math.max(daysSinceStart, 7); d++) {
        const dayStart = new Date(cohortStart || new Date());
        dayStart.setDate(dayStart.getDate() + d - 1);
        const dayISO = dayStart.toISOString().slice(0, 10);
        const activeOnDay = new Set(checkIns.filter((c) => c.completed_at?.slice(0, 10) === dayISO).map((c) => c.user_id));
        const completedFullOnDay = new Set(
          checkIns.filter((c) => c.completed_at?.slice(0, 10) === dayISO).map((c) => c.user_id)
        );
        retention.push({
          day: d,
          pct_active: totalMembers ? (activeOnDay.size / totalMembers) * 100 : 0,
          pct_completed_full: totalMembers ? (completedFullOnDay.size / totalMembers) * 100 : 0,
        });
      }

      // Top members by check-in count
      const checkInCounts = new Map<string, number>();
      checkIns.forEach((c) => checkInCounts.set(c.user_id, (checkInCounts.get(c.user_id) || 0) + 1));
      const streakMap = new Map<string, { current: number; best: number }>();
      streaks.forEach((s) => streakMap.set(s.user_id, { current: s.current_streak || 0, best: s.best_streak || 0 }));
      const usernameMap = new Map<string, string>();
      (allUsernames || []).forEach((p: any) => usernameMap.set(p.id, p.username));
      const topMembers: TopMember[] = Array.from(checkInCounts.entries())
        .map(([id, count]) => ({
          id,
          username: usernameMap.get(id) || 'unknown',
          check_ins: count,
          current_streak: streakMap.get(id)?.current || 0,
          best_streak: streakMap.get(id)?.best || 0,
        }))
        .sort((a, b) => b.check_ins - a.check_ins)
        .slice(0, 5);

      // Top team-feed posters
      const postCounts = new Map<string, number>();
      (allTeamLog || []).forEach((l: any) => postCounts.set(l.user_id, (postCounts.get(l.user_id) || 0) + 1));
      const topPosters: TopPoster[] = Array.from(postCounts.entries())
        .map(([id, posts]) => ({ id, username: usernameMap.get(id) || 'unknown', posts }))
        .sort((a, b) => b.posts - a.posts)
        .slice(0, 5);

      // Members who might need a nudge: 0 check-ins in the last 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoISO = threeDaysAgo.toISOString();
      const recentActive = new Set(
        checkIns.filter((c) => c.completed_at >= threeDaysAgoISO).map((c) => c.user_id)
      );
      const allMemberIds = Array.from(usernameMap.keys());
      const needsNudge: TopMember[] = allMemberIds
        .filter((id) => !recentActive.has(id))
        .map((id) => ({
          id,
          username: usernameMap.get(id) || 'unknown',
          check_ins: checkInCounts.get(id) || 0,
          current_streak: streakMap.get(id)?.current || 0,
          best_streak: streakMap.get(id)?.best || 0,
        }))
        .sort((a, b) => a.current_streak - b.current_streak) // weakest streaks first
        .slice(0, 5);

      setMetrics({
        total_members: totalMembers || 0,
        active_today: todayUsers.size,
        avg_streak: Math.round(avg * 10) / 10,
        best_streak: best,
        median_streak: median,
        cohort_avg_blocks_per_day: Math.round(blocksPerDay * 10) / 10,
        total_check_ins: checkIns.length,
        total_teams: totalTeams || 0,
        total_reports: totalReports || 0,
        total_community_posts: totalCommunityPosts || 0,
        total_achievements: totalAchievements || 0,
        total_streak_freezes: totalFreezes || 0,
        retention_by_day: retention,
        top_members: topMembers,
        top_posters: topPosters,
        needs_nudge: needsNudge,
      });
      setDailyActive((dailyActiveData || []) as DailyActive[]);
    } catch (e) {
      console.warn('analytics load failed', e);
      toast.error('Could not load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = () => {
    if (!metrics) return;
    const rows: string[] = ['day,pct_active,pct_completed_full'];
    metrics.retention_by_day.forEach((r) => rows.push(`${r.day},${r.pct_active.toFixed(2)},${r.pct_completed_full.toFixed(2)}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-retention-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Retention CSV downloaded');
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-3.5">
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Members" value={metrics.total_members} />
        <Stat label="Active today" value={metrics.active_today} subtext={`${Math.round((metrics.active_today / Math.max(metrics.total_members, 1)) * 100)}% of cohort`} />
        <Stat label="Avg streak" value={`${metrics.avg_streak}d`} subtext={`Median: ${metrics.median_streak}d`} />
        <Stat label="Best streak" value={`${metrics.best_streak}d`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Teams" value={metrics.total_teams} />
        <Stat label="Reports" value={metrics.total_reports} />
        <Stat label="Check-ins" value={metrics.total_check_ins} />
        <Stat label="Achievements" value={metrics.total_achievements} subtext={`${metrics.total_streak_freezes} freezes earned`} />
      </div>

      {/* Retention curve */}
      <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-neutral-500" />
              <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Retention Curve</h3>
            </div>
            <p className="text-[10px] text-neutral-500">% of cohort active each day since Day 1</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="h-8 w-8 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 flex items-center justify-center"
              title="Refresh"
              aria-label="Refresh analytics"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportCSV}
              className="h-8 px-3 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] font-bold uppercase tracking-wider hover:border-neutral-600 inline-flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        </div>

        <RetentionChart data={metrics.retention_by_day} />
      </section>

      {/* Daily active (recent) */}
      {dailyActive.length > 0 && (
        <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
          <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-4">Daily Active · Last 30 days</h3>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
            {dailyActive.slice(0, 30).map((d) => {
              const date = new Date(d.day);
              return (
                <div key={d.day} className="flex flex-col items-center" title={`${d.day}: ${d.active_members} active`}>
                  <div
                    className="w-full aspect-square rounded bg-amber-500/30 hover:bg-amber-500/50 transition-colors"
                    style={{ opacity: Math.max(0.15, d.active_members / Math.max(metrics.total_members, 1)) }}
                  />
                  <span className="text-[8px] text-neutral-600 mt-1 font-mono">{date.getDate()}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top contributors + members to nudge */}
      <div className="grid md:grid-cols-2 gap-3">
        <TopList
          title="Top contributors"
          subtitle="Most check-ins"
          emptyText="No check-ins yet."
          entries={metrics.top_members.map((m, i) => ({
            id: m.id,
            label: m.username,
            href: `/u/${m.username}`,
            primary: `${m.check_ins} check-ins`,
            secondary: `${m.current_streak}d streak · best ${m.best_streak}d`,
            rank: i + 1,
          }))}
        />
        <TopList
          title="Most active team posters"
          subtitle="Team feed activity"
          emptyText="No team posts yet."
          entries={metrics.top_posters.map((p, i) => ({
            id: p.id,
            label: p.username,
            href: `/u/${p.username}`,
            primary: `${p.posts} ${p.posts === 1 ? 'post' : 'posts'}`,
            secondary: null,
            rank: i + 1,
          }))}
        />
      </div>

      {metrics.needs_nudge.length > 0 && (
        <section className="rounded-2xl border border-amber-700/30 bg-amber-950/10 p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{"\u26A0\uFE0F"}</span>
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-[0.2em]">Needs a nudge</h3>
          </div>
          <p className="text-[10px] text-amber-200/60 mb-4 leading-relaxed">
            No check-ins in the last 3 days. Reach out before the streak breaks.
          </p>
          <div className="space-y-1.5">
            {metrics.needs_nudge.map((m) => (
              <a
                key={m.id}
                href={`/u/${m.username}`}
                className="flex items-center justify-between rounded-lg bg-neutral-900/60 border border-amber-900/30 px-3 py-2.5 hover:border-amber-700/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-extrabold text-amber-100 truncate">{m.username}</span>
                  <span className="text-[10px] text-neutral-500">best {m.best_streak}d</span>
                </div>
                <span className="text-[10px] text-amber-300 font-mono shrink-0">{m.current_streak}d current</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TopList({
  title,
  subtitle,
  emptyText,
  entries,
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  entries: { id: string; label: string; href: string; primary: string; secondary: string | null; rank: number }[];
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
      <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-1">{title}</h3>
      <p className="text-[10px] text-neutral-500 mb-4">{subtitle}</p>
      {entries.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-4">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.id}>
              <a
                href={e.href}
                className="flex items-center gap-3 rounded-lg bg-neutral-900/40 border border-neutral-900 px-3 py-2.5 hover:border-amber-700/30 transition-colors"
              >
                <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-white truncate">{e.label}</p>
                  {e.secondary && <p className="text-[10px] text-neutral-500 mt-0.5">{e.secondary}</p>}
                </div>
                <span className="text-xs font-mono text-amber-300 font-extrabold shrink-0">{e.primary}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Stat({ label, value, subtext }: { label: string; value: number | string; subtext?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-3.5">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1.5">{label}</p>
      <p className="text-2xl font-black text-amber-100">{value}</p>
      {subtext && <p className="text-[10px] text-neutral-500 mt-0.5">{subtext}</p>}
    </div>
  );
}

function RetentionChart({ data }: { data: { day: number; pct_active: number }[] }) {
  const W = 600;
  const H = 160;
  const padX = 24;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const maxDay = Math.max(data.length, 7);
  const stepX = innerW / Math.max(maxDay - 1, 1);
  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - (d.pct_active / 100) * innerH,
    d,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${padX + innerW} ${padY + innerH} L ${padX} ${padY + innerH} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="ret-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0B030" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F0B030" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={padX}
            y1={padY + innerH - (pct / 100) * innerH}
            x2={padX + innerW}
            y2={padY + innerH - (pct / 100) * innerH}
            stroke="#222222"
            strokeWidth="1"
          />
        ))}
        {/* Area */}
        <path d={area} fill="url(#ret-grad)" />
        {/* Line */}
        <path d={path} fill="none" stroke="#F0B030" strokeWidth="2" />
        {/* Points */}
        {points.map((p) => (
          <circle key={p.d.day} cx={p.x} cy={p.y} r="3" fill="#F0B030" />
        ))}
        {/* X labels */}
        {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p) => (
          <text key={p.d.day} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#5A5A5A">D{p.d.day}</text>
        ))}
        {/* Y labels */}
        {[0, 50, 100].map((pct) => (
          <text key={pct} x={4} y={padY + innerH - (pct / 100) * innerH + 3} fontSize="9" fill="#5A5A5A">{pct}%</text>
        ))}
      </svg>
    </div>
  );
}
