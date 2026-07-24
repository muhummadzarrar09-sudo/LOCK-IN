'use client';

import { useEffect, useState } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { userId: string };

type Insights = {
  peakHour: string | null;
  peakDay: string | null;
};

const DAY_LABELS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * "Personal insights" — two pills on the dashboard showing the user's
 * power hour (most common check-in hour-of-day) and best day
 * (most common check-in day-of-week).
 *
 * Single fetch + computation, shared between both pills.
 * Renders nothing until 5+ check-ins (statistical floor).
 */
export function BestTimeInsight({ userId }: Props) {
  const [insights, setInsights] = useState<Insights>({ peakHour: null, peakDay: null });

  useEffect(() => {
    (async () => {
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(180);
      if (!checkIns || checkIns.length < 5) return;
      const byHour = new Array(24).fill(0);
      const byDay = new Array(7).fill(0);
      checkIns.forEach((c: any) => {
        const d = new Date(c.completed_at);
        byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
        byDay[d.getDay()] = (byDay[d.getDay()] || 0) + 1;
      });
      let peakHourCount = 0;
      let peakHourIdx = 0;
      byHour.forEach((c, h) => {
        if (c > peakHourCount) {
          peakHourCount = c;
          peakHourIdx = h;
        }
      });
      let peakDayCount = 0;
      let peakDayIdx = 0;
      byDay.forEach((c, d) => {
        if (c > peakDayCount) {
          peakDayCount = c;
          peakDayIdx = d;
        }
      });
      setInsights({
        peakHour: peakHourCount > 0 ? formatHour(peakHourIdx) : null,
        peakDay: peakDayCount > 0 ? DAY_LABELS[peakDayIdx] : null,
      });
    })();
  }, [userId]);

  if (!insights.peakHour && !insights.peakDay) return null;

  return (
    <>
      {insights.peakHour && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/20 border border-amber-800/30 text-[10px] text-amber-200 font-bold uppercase tracking-wider">
          <Clock className="w-3 h-3" />
          Power hour: {insights.peakHour}
        </div>
      )}
      {insights.peakDay && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950/20 border border-violet-800/30 text-[10px] text-violet-200 font-bold uppercase tracking-wider">
          <Calendar className="w-3 h-3" />
          Best day: {insights.peakDay}
        </div>
      )}
    </>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
