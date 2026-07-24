'use client';

import Link from 'next/link';
import { Award, ArrowRight, Lock } from 'lucide-react';
import { getAchievement, ACHIEVEMENTS } from '@/lib/achievements';

type Props = {
  currentStreak: number;
};

/**
 * "Next milestone" widget for the dashboard. Shows the next badge
 * the user is working toward, with a progress bar, so the grind
 * feels tangible rather than abstract.
 */
export function NextMilestone({ currentStreak }: Props) {
  // Find the next milestone the user hasn't hit yet.
  const orderedCodes = Object.keys(ACHIEVEMENTS);
  let nextCode: string | null = null;
  let nextThreshold = 0;
  for (const code of orderedCodes) {
    const threshold = parseInt(code.replace('streak_', ''), 10);
    if (currentStreak < threshold) {
      nextCode = code;
      nextThreshold = threshold;
      break;
    }
  }

  if (!nextCode) {
    // Past the 100-day mark — show "max" state
    return (
      <Link
        href="/history"
        className="block rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10 p-4 hover:border-amber-500/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/15 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold">All milestones earned</p>
            <p className="text-sm text-amber-100 font-extrabold mt-0.5">You&apos;ve unlocked every badge.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-300/60 group-hover:text-amber-200 transition-colors" />
        </div>
      </Link>
    );
  }

  const meta = getAchievement(nextCode);
  if (!meta) return null;

  // Find the previous threshold to anchor the progress bar
  let prevThreshold = 0;
  for (const code of orderedCodes) {
    const threshold = parseInt(code.replace('streak_', ''), 10);
    if (threshold < nextThreshold) prevThreshold = threshold;
  }

  const daysIn = currentStreak - prevThreshold;
  const daysTotal = nextThreshold - prevThreshold;
  const pct = Math.max(0, Math.min(100, (daysIn / daysTotal) * 100));
  const daysToGo = nextThreshold - currentStreak;

  return (
    <Link
      href="/history"
      className="block rounded-2xl border border-neutral-800 bg-[#121212]/60 p-4 hover:border-amber-700/30 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
          style={{
            background: meta.bgColor,
            borderColor: `${meta.ringColor}55`,
          }}
        >
          <Lock className="w-3.5 h-3.5" style={{ color: meta.ringColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Next milestone</p>
          <p className="text-sm text-white font-extrabold mt-0.5 truncate">
            {meta.title} <span className="text-neutral-500 font-mono text-[11px] ml-1">at {nextThreshold} days</span>
          </p>
        </div>
        <span className="text-[10px] font-mono text-amber-300/80 font-extrabold shrink-0">
          {daysToGo === 0 ? 'Today!' : `${daysToGo}d to go`}
        </span>
      </div>
      <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${meta.ringColor}, ${meta.ringColor}aa)`,
          }}
        />
      </div>
      <p className="text-[10px] text-neutral-500 mt-2 leading-relaxed">{meta.blurb}</p>
    </Link>
  );
}
