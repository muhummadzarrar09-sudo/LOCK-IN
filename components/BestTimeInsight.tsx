'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { userId: string };

/**
 * "Your power hour" — a small insight on the dashboard showing the
 * hour of day the user most commonly checks in. Renders only if the
 * user has at least 5 check-ins (otherwise the sample is too small).
 */
export function BestTimeInsight({ userId }: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(120);
      if (!checkIns || checkIns.length < 5) {
        setLabel(null);
        return;
      }
      const byHour = new Array(24).fill(0);
      checkIns.forEach((c: any) => {
        const h = new Date(c.completed_at).getHours();
        byHour[h] = (byHour[h] || 0) + 1;
      });
      let peak = 0;
      let peakHour = 0;
      byHour.forEach((c, h) => {
        if (c > peak) {
          peak = c;
          peakHour = h;
        }
      });
      if (peak === 0) {
        setLabel(null);
        return;
      }
      setLabel(formatHour(peakHour));
      setCount(peak);
    })();
  }, [userId]);

  if (!label) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/20 border border-amber-800/30 text-[10px] text-amber-200 font-bold uppercase tracking-wider">
      <Clock className="w-3 h-3" />
      Power hour: {label}
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
