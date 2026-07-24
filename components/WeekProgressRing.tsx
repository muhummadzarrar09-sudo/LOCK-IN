'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp } from 'lucide-react';

type Props = {
  userId: string;
  // 7-cell array of "blocks done that day" for the last 7 days.
  // Computed upstream; if absent we fetch ourselves.
  data?: number[];
};

/**
 * "This week" SVG ring showing % of expected check-ins completed.
 * 7-day window with 6 blocks per day = 42 total expected. Renders
 * a smooth animated SVG arc.
 */
export function WeekProgressRing({ userId, data }: Props) {
  const [byDay, setByDay] = useState<number[] | null>(data || null);

  useEffect(() => {
    if (data) { setByDay(data); return; }
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceISO = since.toISOString();
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('completed_at')
        .eq('user_id', userId)
        .gte('completed_at', sinceISO);
      // Bucket by day
      const counts = new Array(7).fill(0);
      (checkIns || []).forEach((c: any) => {
        const day = Math.floor((Date.now() - new Date(c.completed_at).getTime()) / (1000 * 60 * 60 * 24));
        if (day >= 0 && day < 7) counts[6 - day]++; // 6 days ago → index 0
      });
      setByDay(counts);
    })();
  }, [userId, data]);

  if (!byDay) return null;
  const total = byDay.reduce((s, n) => s + n, 0);
  // Expected: 6 blocks/day * 7 days = 42. But be realistic: 0–42 maps to 0–100%.
  const expected = 42;
  const pct = Math.min(100, Math.round((total / expected) * 100));

  // SVG arc math
  const R = 38;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-4">
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="url(#weekGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
              style={{ transition: 'stroke-dasharray 600ms ease' }}
            />
            <defs>
              <linearGradient id="weekGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-black text-amber-100">{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">This week</p>
          </div>
          <p className="text-base font-extrabold text-white leading-tight">
            {total} {total === 1 ? 'check-in' : 'check-ins'}
          </p>
          <p className="text-[10px] text-neutral-500 mt-0.5 leading-relaxed">
            {pct >= 90 ? 'Locked in. The habit is the identity now.' :
              pct >= 60 ? 'Solid pace. Keep the chain unbroken.' :
              pct >= 30 ? 'Some movement. Tomorrow is a clean slate.' :
              'Quiet week. One block is enough to restart the chain.'}
          </p>
        </div>
      </div>
      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1 mt-3 pt-3 border-t border-neutral-900">
        {byDay.map((n, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const isToday = i === 6;
          const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
          return (
            <div key={i} className="text-center">
              <div
                className={`aspect-square rounded-sm mb-1 ${
                  n === 0
                    ? 'bg-neutral-900 border border-neutral-800'
                    : n >= 6
                    ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                    : 'bg-amber-700/60'
                } ${isToday ? 'ring-1 ring-amber-300/60' : ''}`}
              />
              <span className={`text-[9px] font-bold ${isToday ? 'text-amber-300' : 'text-neutral-500'}`}>{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
