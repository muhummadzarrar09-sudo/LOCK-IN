import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/security';

type TopMember = { id: string; username: string; check_ins: number; current_streak: number; best_streak: number };
type TopPoster = { id: string; username: string; posts: number };

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin();
    await rateLimit(request, { key: 'admin:analytics', limit: 30, windowMs: 60_000, userId: actor.id });
    const supabase = createSupabaseAdminClient();

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
      { data: latestCohort },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member'),
      supabase.from('streaks').select('user_id, current_streak, best_streak'),
      supabase.from('profiles').select('id, created_at').eq('role', 'member'),
      supabase.from('check_ins').select('user_id, completed_at, missed'),
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('community_posts').select('*', { count: 'exact', head: true }),
      supabase.from('achievements').select('*', { count: 'exact', head: true }),
      supabase.from('streak_freezes').select('*', { count: 'exact', head: true }),
      supabase.from('cohort_daily_active').select('*').limit(30),
      supabase.from('profiles').select('id, username').eq('role', 'member'),
      supabase.from('team_startup_log').select('user_id'),
      supabase.from('cohorts').select('start_date, end_date').order('start_date', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const streaks = (streaksData || []) as any[];
    const checkIns = ((checkInsData || []) as any[]).filter((c) => c.missed !== true);
    const profiles = (profilesData || []) as any[];
    const memberCount = totalMembers || 0;

    const todayISO = new Date().toISOString().slice(0, 10);
    const todayUsers = new Set(checkIns.filter((c) => c.completed_at?.slice(0, 10) === todayISO).map((c) => c.user_id));
    const avg = streaks.length ? streaks.reduce((s, x) => s + (x.current_streak || 0), 0) / streaks.length : 0;
    const best = streaks.reduce((m, x) => Math.max(m, x.best_streak || 0), 0);
    const sorted = [...streaks.map((s) => s.current_streak || 0)].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    const userDays = new Map<string, Set<string>>();
    checkIns.forEach((c) => {
      const day = c.completed_at?.slice(0, 10);
      if (!day) return;
      if (!userDays.has(c.user_id)) userDays.set(c.user_id, new Set());
      userDays.get(c.user_id)!.add(day);
    });
    const blocksPerDay = Array.from(userDays.values()).reduce((s, days) => s + days.size, 0) / Math.max(streaks.length, 1);

    const cohortStart = (() => {
      const earliest = profiles.map((p) => p.created_at).filter(Boolean).sort()[0];
      return earliest ? new Date(earliest) : null;
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
      retention.push({
        day: d,
        pct_active: memberCount ? (activeOnDay.size / memberCount) * 100 : 0,
        pct_completed_full: memberCount ? (activeOnDay.size / memberCount) * 100 : 0,
      });
    }

    const checkInCounts = new Map<string, number>();
    checkIns.forEach((c) => checkInCounts.set(c.user_id, (checkInCounts.get(c.user_id) || 0) + 1));

    const byHour = new Array(24).fill(0);
    checkIns.forEach((c) => {
      const h = new Date(c.completed_at).getUTCHours();
      byHour[h] = (byHour[h] || 0) + 1;
    });
    const maxHour = byHour.reduce<{ hour: number; count: number } | null>((acc, count, hour) => {
      if (acc === null || count > acc.count) return { hour, count };
      return acc;
    }, null);
    const peakHour = maxHour && maxHour.count > 0 ? maxHour : null;

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

    const postCounts = new Map<string, number>();
    (allTeamLog || []).forEach((l: any) => postCounts.set(l.user_id, (postCounts.get(l.user_id) || 0) + 1));
    const topPosters: TopPoster[] = Array.from(postCounts.entries())
      .map(([id, posts]) => ({ id, username: usernameMap.get(id) || 'unknown', posts }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 5);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();
    const recentActive = new Set(checkIns.filter((c) => c.completed_at >= threeDaysAgoISO).map((c) => c.user_id));
    const needsNudge: TopMember[] = Array.from(usernameMap.keys())
      .filter((id) => !recentActive.has(id))
      .map((id) => ({
        id,
        username: usernameMap.get(id) || 'unknown',
        check_ins: checkInCounts.get(id) || 0,
        current_streak: streakMap.get(id)?.current || 0,
        best_streak: streakMap.get(id)?.best || 0,
      }))
      .sort((a, b) => a.current_streak - b.current_streak)
      .slice(0, 5);

    let cohortProgress = null;
    if (latestCohort?.start_date && latestCohort?.end_date) {
      const start = new Date(`${latestCohort.start_date}T00:00:00Z`);
      const end = new Date(`${latestCohort.end_date}T23:59:59Z`);
      const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const dayNumber = diffDays + 1;
      const phase = dayNumber < 1 ? 'pre' : dayNumber > total ? 'done' : 'running';
      const pct = Math.max(0, Math.min(100, Math.round((dayNumber / total) * 100)));
      const activeRate = memberCount > 0 ? Math.round((todayUsers.size / memberCount) * 100) : 0;
      const streakComponent = Math.min(100, (avg / 30) * 100);
      const healthScore = Math.round(activeRate * 0.6 + streakComponent * 0.4);
      const healthLabel = healthScore >= 70 ? 'thriving' : healthScore >= 40 ? 'steady' : 'at risk';
      cohortProgress = {
        dayNumber: Math.max(1, Math.min(total, dayNumber)),
        total,
        pct,
        phase,
        activeRate,
        healthScore,
        healthLabel,
      };
    }

    return NextResponse.json({
      metrics: {
        total_members: memberCount,
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
        peak_hour: peakHour,
        checkins_by_hour: byHour,
        cohort_progress: cohortProgress,
      },
      dailyActive: dailyActiveData || [],
    });
  } catch (error) {
    return jsonError(error);
  }
}
