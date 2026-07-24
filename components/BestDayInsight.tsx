'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { userId: string };

const DAY_LABELS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * "Your best day" — small insight pill on the dashboard showing the
 * day of the week the user most commonly checks in. Renders only
 * after at least 7 check-ins (one week's worth).
 */
export function BestDayInsight({ userId }: Props) {
  const [bestDay, setBestDay] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(180);
      if (!checkIns || checkIns.length < 7) {
        setBestDay(null);
        return;
      }
      const byDay = new Array(7).fill(0);
      checkIns.forEach((c: any) => {
        const d = new Date(c.completed_at).getDay();
        byDay[d] = (byDay[d] || 0) + 1;
      });
      let peak = 0;
      let peakDay = 0;
      byDay.forEach((c, d) => {
        if (c > peak) {
          peak = c;
          peakDay = d;
        }
      });
      if (peak === 0) {
        setBestDay(null);
        return;
      }
      setBestDay(DAY_LABELS[peakDay]);
      setCount(peak);
    })();
  }, [userId]);

  if (!bestDay) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950/20 border border-violet-800/30 text-[10px] text-violet-200 font-bold uppercase tracking-wider">
      <Calendar className="w-3 h-3" />
      Best day: {bestDay}
    </div>
  );
}
