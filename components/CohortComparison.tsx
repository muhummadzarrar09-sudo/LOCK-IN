'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Users, ArrowUp } from 'lucide-react';

const STORAGE_KEY = 'discipline.lastRankSnapshot.v1';

type Snapshot = { rank: number; total: number; savedAt: number };

type Props = {
  userId: string;
  currentStreak: number;
  currentBest: number;
};

/**
 * "You vs. the cohort" card. Shows percentile, head-to-head comparison
 * vs the median member, and a small rank-change indicator if the user
 * has climbed or dropped since the last visit.
 *
 * Stores the last-seen rank in localStorage to compute deltas — no new
 * server column needed.
 */
export function CohortComparison({ userId, currentStreak, currentBest }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    rank: number;
    total: number;
    median: number;
    avg: number;
    percentile: number; // 0-100, higher is better
    rankDelta: number; // negative = climbed, positive = dropped
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Fetch the user's current rank from the leaderboard view
        const { data: leaderboard, count } = await supabase
          .from('leaderboard')
          .select('*', { count: 'exact' })
          .order('rank', { ascending: true });
        if (!leaderboard) {
          setLoading(false);
          return;
        }
        const me = (leaderboard as any[]).find((e) => e.id === userId);
        if (!me) {
          setLoading(false);
          return;
        }
        const myRank: number = me.rank;
        const total: number = count || leaderboard.length;
        // Compute median streak
        const allStreaks = (leaderboard as any[]).map((e) => e.streak).sort((a, b) => a - b);
        const median = allStreaks.length > 0 ? allStreaks[Math.floor(allStreaks.length / 2)] : 0;
        const avg = allStreaks.length > 0
          ? Math.round((allStreaks.reduce((s, n) => s + n, 0) / allStreaks.length) * 10) / 10
          : 0;
        const percentile = total > 0
          ? Math.max(0, Math.min(100, Math.round(((total - myRank) / total) * 100)))
          : 0;

        // Compare to last-snapshot
        let rankDelta = 0;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const snap: Snapshot = JSON.parse(raw);
            // Only compare if the snapshot is from this week (avoid stale jumps)
            if (Date.now() - snap.savedAt < 14 * 24 * 60 * 60 * 1000) {
              rankDelta = snap.rank - myRank; // positive = climbed
            }
          }
          // Save new snapshot
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ rank: myRank, total, savedAt: Date.now() }));
        } catch { /* ignore */ }

        setData({ rank: myRank, total, median, avg, percentile, rankDelta });
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading || !data) return null;
  if (data.total < 2) return null; // need at least 2 members to compare

  const isAboveMedian = currentStreak > data.median;
  const isAboveAvg = currentStreak > data.avg;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-amber-300" />
          <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em]">
            You vs. the cohort
          </h2>
        </div>
        <Link
          href="/leaderboard"
          className="text-[10px] text-amber-300 hover:text-amber-200 font-bold uppercase tracking-wider inline-flex items-center gap-1"
        >
          Full board <ArrowUp className="w-3 h-3 rotate-45" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label="Your rank"
          value={`#${data.rank}`}
          sub={
            data.rankDelta > 0
              ? `↑ ${data.rankDelta} since last visit`
              : data.rankDelta < 0
              ? `↓ ${Math.abs(data.rankDelta)} since last visit`
              : 'No change'
          }
          subClass={data.rankDelta > 0 ? 'text-emerald-300' : data.rankDelta < 0 ? 'text-red-300' : 'text-neutral-500'}
        />
        <Stat
          label="Percentile"
          value={`Top ${100 - data.percentile}%`}
          sub={`of ${data.total} members`}
        />
        <Stat
          label="vs. median"
          value={isAboveMedian ? 'Above' : currentStreak === data.median ? 'At' : 'Below'}
          sub={`median is ${data.median}d`}
          subClass={isAboveMedian ? 'text-emerald-300' : isAboveMedian === false && currentStreak < data.median ? 'text-amber-300' : 'text-neutral-500'}
        />
        <Stat
          label="vs. average"
          value={isAboveAvg ? 'Above' : currentStreak === data.avg ? 'At' : 'Below'}
          sub={`avg is ${data.avg}d`}
          subClass={isAboveAvg ? 'text-emerald-300' : isAboveAvg === false && currentStreak < data.avg ? 'text-amber-300' : 'text-neutral-500'}
        />
      </div>

      {/* Visual bar: your streak vs. median vs. best */}
      <div className="mt-4 pt-4 border-t border-neutral-900">
        <div className="flex items-end gap-2 h-12">
          <Bar
            label="You"
            value={currentStreak}
            color="from-amber-400 to-amber-500"
            max={Math.max(currentBest, data.median, 1)}
            highlight
          />
          <Bar
            label="Median"
            value={data.median}
            color="from-neutral-600 to-neutral-700"
            max={Math.max(currentBest, data.median, 1)}
          />
          <Bar
            label="Best"
            value={currentBest}
            color="from-violet-500 to-violet-700"
            max={Math.max(currentBest, data.median, 1)}
          />
        </div>
        <p className="text-[10px] text-neutral-500 mt-2">
          {data.percentile >= 90
            ? 'Top 10%. You\u2019re in rare air.'
            : data.percentile >= 50
            ? 'Above the median. The habit is holding.'
            : data.percentile >= 25
            ? 'Mid-pack. Room to climb.'
            : 'Lots of room. One check-in at a time.'}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, subClass }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <div className="rounded-lg bg-[#0D0D0D]/40 p-3 border border-neutral-900">
      <p className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mb-1">{label}</p>
      <p className="text-base font-black text-amber-100 leading-tight">{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${subClass || 'text-neutral-500'}`}>{sub}</p>}
    </div>
  );
}

function Bar({ label, value, color, max, highlight }: { label: string; value: number; color: string; max: number; highlight?: boolean }) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="w-full h-12 flex items-end">
        <div
          className={`w-full rounded-t bg-gradient-to-t ${color} ${highlight ? 'ring-1 ring-amber-300/50' : ''}`}
          style={{ height: `${pct}%` }}
        />
      </div>
      <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider mt-1.5">{label}</p>
      <p className={`text-[10px] font-extrabold ${highlight ? 'text-amber-200' : 'text-neutral-400'}`}>{value}d</p>
    </div>
  );
}
