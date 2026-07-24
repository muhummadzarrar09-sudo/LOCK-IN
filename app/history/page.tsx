"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Flame, Trophy, Target, TrendingUp, CheckCircle2, Circle, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import { SkeletonList } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';

type DayCell = {
  date: string; // YYYY-MM-DD
  blocksDone: number;
  blocksTotal: number;
  isToday: boolean;
  isFuture: boolean;
};

const COHORT_DAYS = 30;

/**
 * 30-day execution history. Renders a calendar-style grid showing
 * how many time blocks the user completed on each day of the cohort.
 * Uses existing check_ins + time_blocks data — no new schema.
 */
export default function HistoryPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<DayCell[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [cohortStart, setCohortStart] = useState<string | null>(null);
  const [cohortEnd, setCohortEnd] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/history');
        return;
      }
      const uid = session.user.id;

      // Fetch streak + cohort + blocks in parallel
      const [streakRes, cohortRes, blocksRes] = await Promise.all([
        supabase.from('streaks').select('current_streak, best_streak').eq('user_id', uid).maybeSingle(),
        supabase.from('cohorts').select('start_date, end_date').order('start_date', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('time_blocks').select('id').eq('user_id', uid),
      ]);

      const streakData = streakRes.data;
      if (streakData) {
        setStreak((streakData as any).current_streak || 0);
        setBest((streakData as any).best_streak || 0);
      }
      const cohort = cohortRes.data;
      const start = (cohort as any)?.start_date as string | undefined;
      const end = (cohort as any)?.end_date as string | undefined;
      setCohortStart(start || null);
      setCohortEnd(end || null);

      // Build the 30-day grid. Anchor on cohort start; if not set, anchor 30 days back from today.
      const anchor = start ? new Date(`${start}T00:00:00Z`) : new Date();
      if (!start) {
        anchor.setDate(anchor.getDate() - (COHORT_DAYS - 1));
        anchor.setUTCHours(0, 0, 0, 0);
      }
      const todayISO = new Date().toISOString().slice(0, 10);

      // Build all day cells
      const cells: DayCell[] = [];
      for (let i = 0; i < COHORT_DAYS; i++) {
        const d = new Date(anchor);
        d.setUTCDate(d.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        cells.push({
          date: iso,
          blocksDone: 0,
          blocksTotal: 0,
          isToday: iso === todayISO,
          isFuture: d.getTime() > Date.now(),
        });
      }

      const totalBlocks = (blocksRes.data || []).length;
      cells.forEach((c) => { c.blocksTotal = totalBlocks; });

      // Fetch check_ins grouped by day
      const fromISO = cells[0]?.date;
      if (fromISO) {
        const { data: checkIns } = await supabase
          .from('check_ins')
          .select('completed_at, time_block_id')
          .eq('user_id', uid)
          .gte('completed_at', `${fromISO}T00:00:00Z`);
        const dayMap = new Map<string, Set<string>>();
        (checkIns || []).forEach((c: any) => {
          const iso = (c.completed_at as string).slice(0, 10);
          if (!dayMap.has(iso)) dayMap.set(iso, new Set());
          dayMap.get(iso)!.add(c.time_block_id);
        });
        cells.forEach((c) => {
          const s = dayMap.get(c.date);
          if (s) c.blocksDone = s.size;
        });
      }

      setGrid(cells);
      setLoading(false);
    };
    load();
  }, [router]);

  // Summary stats
  const stats = useMemo(() => {
    const past = grid.filter((c) => !c.isFuture);
    const totalDone = past.reduce((s, c) => s + c.blocksDone, 0);
    const fullDays = past.filter((c) => c.blocksTotal > 0 && c.blocksDone >= c.blocksTotal).length;
    const totalPossible = past.reduce((s, c) => s + c.blocksTotal, 0);
    const completionPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
    return { totalDone, fullDays, totalPossible, completionPct };
  }, [grid]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <PageHeader
            icon={Calendar}
            title="30-Day History"
            subtitle={
              cohortStart
                ? `Cohort: ${new Date(cohortStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${cohortEnd ? new Date(cohortEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '…'}`
                : 'Your execution over the last 30 days'
            }
          />

          {loading ? (
            <SkeletonList rows={3} />
          ) : grid.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No history yet"
              description="Check in to your first time block on the dashboard to start building your execution log."
              primaryAction={{ label: 'Go to dashboard', href: '/dashboard' }}
            />
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatChip icon={Flame} label="Current streak" value={`${streak}d`} accent="amber" />
                <StatChip icon={Trophy} label="Best streak" value={`${best}d`} accent="amber" />
                <StatChip icon={Target} label="Full days" value={`${stats.fullDays}`} accent="emerald" />
                <StatChip icon={TrendingUp} label="Completion" value={`${stats.completionPct}%`} accent="amber" />
              </div>

              {/* Calendar grid */}
              <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em]">
                    Cohort days
                  </h2>
                  <div className="flex items-center gap-2 text-[9px] text-neutral-500 font-bold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-amber-400" /> full
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-amber-700/50" /> partial
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-neutral-900 border border-neutral-800" /> missed
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                  {grid.map((cell) => (
                    <DayCellBox key={cell.date} cell={cell} />
                  ))}
                </div>
                <p className="text-[10px] text-neutral-500 mt-4 leading-relaxed">
                  Each square is one day. Filled-in = check-ins completed. Brighter = full day. Empty = no check-ins (or day hasn&apos;t happened yet).
                </p>
              </section>

              {/* Milestone callouts */}
              <section className="mt-6 rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/20 to-transparent p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <h3 className="text-xs font-extrabold text-amber-200/80 uppercase tracking-[0.2em]">Milestones</h3>
                </div>
                <ul className="space-y-2 text-sm text-neutral-300">
                  <li className="flex items-center justify-between">
                    <span>3-day streak</span>
                    <MilestonePill done={best >= 3} />
                  </li>
                  <li className="flex items-center justify-between">
                    <span>7-day streak</span>
                    <MilestonePill done={best >= 7} />
                  </li>
                  <li className="flex items-center justify-between">
                    <span>14-day streak</span>
                    <MilestonePill done={best >= 14} />
                  </li>
                  <li className="flex items-center justify-between">
                    <span>30-day streak (the contract)</span>
                    <MilestonePill done={best >= 30} />
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function StatChip({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: 'amber' | 'emerald' }) {
  const colorClass = accent === 'emerald' ? 'text-emerald-100' : 'text-amber-100';
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3 h-3 ${accent === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</span>
      </div>
      <p className={`text-2xl font-black ${colorClass}`}>{value}</p>
    </div>
  );
}

function DayCellBox({ cell }: { cell: DayCell }) {
  const { date, blocksDone, blocksTotal, isToday, isFuture } = cell;

  let bg = 'bg-neutral-900/60 border-neutral-800';
  let textColor = 'text-neutral-700';
  let label: string | null = null;

  if (isFuture) {
    bg = 'bg-transparent border-neutral-900';
    textColor = 'text-neutral-800';
  } else if (blocksTotal === 0) {
    bg = 'bg-neutral-900/30 border-neutral-900';
    textColor = 'text-neutral-700';
  } else {
    const ratio = blocksDone / blocksTotal;
    if (ratio === 0) {
      bg = 'bg-neutral-900/40 border-neutral-900';
      textColor = 'text-neutral-600';
    } else if (ratio < 1) {
      bg = 'bg-amber-900/30 border-amber-900/40';
      textColor = 'text-amber-300';
      label = `${blocksDone}/${blocksTotal}`;
    } else {
      bg = 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-400';
      textColor = 'text-black';
    }
  }

  const dayNum = new Date(`${date}T00:00:00Z`).getUTCDate();

  return (
    <div
      className={`relative aspect-square rounded-md border ${bg} flex items-center justify-center transition-transform hover:scale-105`}
      title={`${date} · ${blocksDone}/${blocksTotal} blocks${isToday ? ' (today)' : ''}`}
      aria-label={`Day ${dayNum}, ${blocksDone} of ${blocksTotal} blocks completed${isToday ? ' (today)' : ''}`}
    >
      <span className={`text-[10px] font-extrabold ${textColor}`}>
        {dayNum}
      </span>
      {isToday && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300 ring-2 ring-[#0D0D0D]" />
      )}
      {label && (
        <span className="absolute bottom-0.5 left-0 right-0 text-center text-[7px] font-extrabold text-amber-200/80 leading-none">
          {label}
        </span>
      )}
    </div>
  );
}

function MilestonePill({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
        done
          ? 'bg-amber-500/20 text-amber-200 border border-amber-700/40'
          : 'bg-neutral-900 text-neutral-600 border border-neutral-800'
      }`}
    >
      {done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
      {done ? 'Earned' : 'Locked'}
    </span>
  );
}
