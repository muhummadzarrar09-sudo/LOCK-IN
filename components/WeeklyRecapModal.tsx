'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { Calendar, Flame, Trophy, TrendingUp, X, Award, Sparkles } from 'lucide-react';
import { ACHIEVEMENTS, getAchievement } from '@/lib/achievements';

const STORAGE_KEY = 'discipline.lastRecapShown.v1';
// Show every 7 days at most
const RECAP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Weekly recap modal. Shows the user's last 7 days: total check-ins,
 * best day, current streak, badges earned in the window. Auto-shows
 * once per week per user (gated by localStorage so we don't need a
 * new server field).
 */
export function WeeklyRecapModal() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalCheckIns: number;
    bestDay: { date: string; count: number } | null;
    avgPerDay: number;
    currentStreak: number;
    bestStreak: number;
    newBadges: { code: string; earned_at: string }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      // Throttle: only show if 7 days passed since last shown
      try {
        const last = localStorage.getItem(STORAGE_KEY);
        if (last && Date.now() - parseInt(last, 10) < RECAP_INTERVAL_MS) {
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }

      // Need at least 1 check-in to bother showing the recap
      const { count: totalCheckIns } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);
      if (!totalCheckIns || totalCheckIns < 1) {
        setLoading(false);
        return;
      }

      // Last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();

      const [{ data: recentCheckIns }, { data: streakData }, { data: recentBadges }] = await Promise.all([
        supabase
          .from('check_ins')
          .select('completed_at')
          .eq('user_id', uid)
          .gte('completed_at', sinceISO),
        supabase
          .from('streaks')
          .select('current_streak, best_streak')
          .eq('user_id', uid)
          .maybeSingle(),
        supabase
          .from('achievements')
          .select('code, earned_at')
          .eq('user_id', uid)
          .gte('earned_at', sinceISO),
      ]);

      // Group check-ins by day
      const dayCounts = new Map<string, number>();
      (recentCheckIns || []).forEach((c: any) => {
        const day = (c.completed_at as string).slice(0, 10);
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      });
      let bestDay: { date: string; count: number } | null = null;
      dayCounts.forEach((count, date) => {
        if (!bestDay || count > bestDay.count) bestDay = { date, count };
      });

      setStats({
        totalCheckIns: recentCheckIns?.length || 0,
        bestDay,
        avgPerDay: Math.round(((recentCheckIns?.length || 0) / 7) * 10) / 10,
        currentStreak: (streakData as any)?.current_streak || 0,
        bestStreak: (streakData as any)?.best_streak || 0,
        newBadges: (recentBadges || []) as any[],
      });
      setOpen(true);
      setLoading(false);
      // Persist last shown time on mount
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
    })();
  }, []);

  // Don't re-show this session if user already dismissed it
  useEffect(() => {
    if (open) {
      const seen = (() => { try { return sessionStorage.getItem('discipline.recapDismissedThisSession.v1'); } catch { return null; } })();
      if (seen) setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    try { sessionStorage.setItem('discipline.recapDismissedThisSession.v1', '1'); } catch { /* ignore */ }
  };

  if (loading || !open || !stats) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-5 bg-black/85 backdrop-blur-md"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-title"
    >
      <div
        className="max-w-md w-full rounded-2xl border border-amber-700/40 bg-[#121212] p-6 md:p-7 shadow-2xl fade-in-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-3.5 h-3.5 text-amber-300" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">Weekly recap</p>
        </div>
        <h2 id="recap-title" className="font-serif text-2xl md:text-3xl tracking-tighter text-white mb-1">
          Your last 7 days.
        </h2>
        <p className="text-xs text-neutral-400 mb-5">The honest summary.</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <Stat
            icon={<Flame className="w-3.5 h-3.5 text-amber-400" />}
            label="Check-ins"
            value={String(stats.totalCheckIns)}
            sub={`${stats.avgPerDay}/day avg`}
          />
          <Stat
            icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />}
            label="Streak"
            value={String(stats.currentStreak)}
            sub={`Best: ${stats.bestStreak}`}
          />
          {stats.bestDay ? (
            <Stat
              icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
              label="Best day"
              value={String(stats.bestDay.count)}
              sub={new Date(`${stats.bestDay.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            />
          ) : (
            <Stat
              icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
              label="Best day"
              value="—"
              sub="No check-ins yet"
            />
          )}
          <Stat
            icon={<Award className="w-3.5 h-3.5 text-amber-400" />}
            label="New badges"
            value={String(stats.newBadges.length)}
            sub={stats.newBadges.length > 0 ? 'in the last 7 days' : 'keep going'}
          />
        </div>

        {stats.newBadges.length > 0 && (
          <div className="rounded-xl bg-amber-950/20 border border-amber-900/40 p-3 mb-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Badges earned this week
            </p>
            <ul className="space-y-1.5">
              {stats.newBadges.map((b) => {
                const meta = getAchievement(b.code);
                if (!meta) return null;
                return (
                  <li key={b.code} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: meta.ringColor }}
                    />
                    <span className="text-amber-100 font-extrabold">{meta.title}</span>
                    <span className="text-neutral-500">— {meta.blurb}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-xs text-neutral-400 leading-relaxed mb-5">
          {stats.totalCheckIns === 0
            ? 'No check-ins this week. Tomorrow is a clean slate.'
            : stats.totalCheckIns < 7
            ? 'Some momentum, room to grow. The streak is what compounds.'
            : stats.totalCheckIns < 30
            ? 'A solid week. The contract is forming.'
            : 'You’re operating at the level this cohort was built for.'}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={dismiss}
            className="flex-1 h-10 rounded-lg bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 transition-colors"
          >
            Back to the work
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 text-center mt-3">
          This recap shows up once a week. Disable anytime in Settings.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0D0D0D]/50 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</span>
      </div>
      <p className="text-xl font-black text-amber-100 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-neutral-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}
