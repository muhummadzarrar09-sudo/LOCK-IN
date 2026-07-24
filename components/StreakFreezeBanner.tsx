'use client';
import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { Snowflake, Sparkles } from 'lucide-react';

/** Shows when the user has unused streak freezes + prompts use if they have a missed day. */
export function StreakFreezeBanner() {
  const toast = useToast();
  const [freezes, setFreezes] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { count } = await supabase
        .from('streak_freezes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .is('used_at', null);
      setFreezes(count || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || freezes === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-sky-700/30 bg-sky-950/15 p-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-sky-400/10 flex items-center justify-center shrink-0">
        <Snowflake className="w-4 h-4 text-sky-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-extrabold text-sky-100">
          You have {freezes} streak freeze{freezes === 1 ? '' : 's'}.
        </p>
        <p className="text-[10px] text-sky-200/70 leading-relaxed">
          Use one to protect your streak if you miss a day. Auto-applied to the next missed day.
        </p>
      </div>
    </div>
  );
}
