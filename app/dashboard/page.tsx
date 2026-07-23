"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Flame, Shield, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type BlockType = 'work' | 'break' | 'movement' | 'reflection';

type Block = {
  id: string; // will be UUID from DB after load, or temp id before
  db_id?: string; // real UUID
  label: string;
  block_type: BlockType;
  start: string;
  end: string;
  completed: boolean;
  day?: number;
};

const DEFAULT_TEMPLATE: Omit<Block, 'id' | 'completed'>[] = [
  { label: 'Deep Work Block 1', block_type: 'work', start: '06:00', end: '09:00', day: 1 },
  { label: 'Protected Break', block_type: 'break', start: '09:00', end: '09:30', day: 1 },
  { label: 'Deep Work Block 2', block_type: 'work', start: '09:30', end: '12:00', day: 1 },
  { label: 'Movement', block_type: 'movement', start: '12:00', end: '12:30', day: 1 },
  { label: 'Reflection / Journal', block_type: 'reflection', start: '12:30', end: '13:00', day: 1 },
  { label: 'Deep Work Block 3', block_type: 'work', start: '13:00', end: '16:00', day: 1 },
];

export default function DashboardPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [streak, setStreak] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [today, setToday] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.push('/auth/login?redirect=/dashboard');
          return;
        }
        const uid = session.user.id;
        setUserId(uid);
        if (session.user.email) setUserEmail(session.user.email);

        // Role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
        if (profile) setUserRole((profile as any).role);

        // Streak
        const { data: streakData } = await supabase.from('streaks').select('current_streak').eq('user_id', uid).maybeSingle();
        if (streakData) setStreak((streakData as any).current_streak || 0);

        // Time blocks
        await loadOrCreateTimeBlocks(uid);

      } catch (e) {
        console.error('Dashboard init error', e);
      } finally {
        setLoadingAuth(false);
      }
    };
    init();
  }, [router]);

  const loadOrCreateTimeBlocks = async (uid: string) => {
    setLoadingBlocks(true);
    try {
      // Try fetch existing blocks for user
      const { data: existingBlocks, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', uid)
        .order('start_time', { ascending: true });

      if (error) {
        console.warn('time_blocks fetch error:', error.message);
      }

      let dbBlocks = existingBlocks || [];

      // If none, create from template
      if (dbBlocks.length === 0) {
        const toInsert = DEFAULT_TEMPLATE.map(t => ({
          user_id: uid,
          day: t.day || 1,
          start_time: t.start,
          end_time: t.end,
          label: t.label,
          block_type: t.block_type,
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('time_blocks')
          .insert(toInsert as any)
          .select();

        if (insertError) {
          console.warn('time_blocks insert error:', insertError.message);
          // If conflict (already exists), re-fetch
          const { data: retry } = await supabase.from('time_blocks').select('*').eq('user_id', uid).order('start_time');
          dbBlocks = retry || [];
        } else {
          dbBlocks = inserted || [];
        }
      }

      // Fetch check_ins to know completed status
      const blockIds = dbBlocks.map((b: any) => b.id);
      let checkInsMap = new Set<string>();
      if (blockIds.length > 0) {
        const { data: checkIns } = await supabase
          .from('check_ins')
          .select('time_block_id')
          .eq('user_id', uid)
          .in('time_block_id', blockIds);
        if (checkIns) {
          checkInsMap = new Set(checkIns.map((c: any) => c.time_block_id));
        }
      }

      const mapped: Block[] = dbBlocks.map((b: any) => ({
        id: b.id,
        db_id: b.id,
        label: b.label,
        block_type: b.block_type,
        start: b.start_time?.slice(0,5) || b.start_time,
        end: b.end_time?.slice(0,5) || b.end_time,
        day: b.day,
        completed: checkInsMap.has(b.id),
      }));

      setBlocks(mapped.length > 0 ? mapped : DEFAULT_TEMPLATE.map((t,i) => ({
        id: `temp-${i}`,
        label: t.label,
        block_type: t.block_type,
        start: t.start,
        end: t.end,
        completed: false,
        day: t.day
      })));

    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleCheckIn = async (blockId: string) => {
    if (!userId) return;
    const target = blocks.find(b => b.id === blockId);
    if (!target) return;

    const newCompleted = !target.completed;
    const newBlocks = blocks.map(b => b.id === blockId ? { ...b, completed: newCompleted } : b);
    setBlocks(newBlocks);

    // Persist
    try {
      const realId = target.db_id || target.id;
      // If it's still a temp id (no DB row yet), try to create time_blocks first
      if (!target.db_id && realId.startsWith('temp-')) {
        console.warn('Block has no DB id yet, cannot persist check-in');
        return;
      }

      if (newCompleted) {
        const { error } = await (supabase.from('check_ins') as any).upsert({
          user_id: userId,
          time_block_id: realId,
          completed_at: new Date().toISOString(),
          missed: false,
        }, { onConflict: 'user_id,time_block_id' });
        if (error) {
          console.warn('check_in upsert error:', error.message);
        } else {
          // Optimistically bump streak if DB trigger will do real increment later
          // We leave streak as is and re-fetch after a moment
          setTimeout(async () => {
            const { data } = await supabase.from('streaks').select('current_streak').eq('user_id', userId).maybeSingle();
            if (data) setStreak((data as any).current_streak || 0);
          }, 500);
        }
      } else {
        // Uncheck -> delete check_in row
        const { error } = await supabase.from('check_ins').delete().eq('user_id', userId).eq('time_block_id', realId);
        if (error) console.warn('check_in delete error:', error.message);
      }
    } catch (err) {
      console.warn('Check-in error', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Loading...</div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
        <div className="max-w-3xl mx-auto px-6 pt-12 pb-20">
          <header className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tighter">Daily Schedule</h1>
                <p className="text-xs text-neutral-500 mt-1">{today} · {timezone} {userEmail && `· ${userEmail}`} {userRole && `· ${userRole}`}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Streak</div>
                  <div className="text-xl font-black text-amber-300 flex items-center gap-1.5">
                    <Flame className="w-5 h-5" /> {streak}
                  </div>
                </div>
                <button onClick={handleSignOut} className="ml-2 w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors" title="Sign out">
                  <LogOut className="w-4 h-4 text-neutral-500" />
                </button>
              </div>
            </div>
            <div className="h-px bg-neutral-800 w-full" />
          </header>

          <div className="mb-8 rounded-xl bg-gradient-to-r from-amber-900/20 to-amber-950/20 border border-amber-900/20 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm mb-1">Accountability Active</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  You are in the active cohort{userRole === 'admin' ? ' (ADMIN MODE)' : ''}. Missing any block breaks your streak visibly. Your team and leaderboard will reflect it immediately. No excuses.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-4">Today&apos;s Blocks {loadingBlocks && '(loading...)'}</h2>
            {blocks.map((block) => (
              <button
                key={block.id}
                onClick={() => handleCheckIn(block.id)}
                className={`w-full text-left rounded-2xl border p-5 transition-all duration-300 group ${
                  block.completed
                    ? 'bg-amber-950/20 border-amber-800/40'
                    : 'bg-[#121212] border-neutral-800 hover:border-neutral-600 hover:bg-[#151515]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${
                      block.completed ? 'bg-amber-400 shadow-[0_0_8px_rgba(240,176,48,0.5)]' : 'bg-neutral-600'
                    }`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                      {block.block_type}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">{block.start} — {block.end}</span>
                </div>
                <h3 className={`text-base font-bold mb-1 ${block.completed ? 'text-amber-100' : 'text-white'}`}>
                  {block.label}
                </h3>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  {block.completed ? (
                    <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed — Streak Protected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Click to confirm check-in
                    </span>
                  )}
                </div>
              </button>
            ))}
          </section>

          <section className="mt-12 rounded-2xl border border-neutral-800 bg-[#121212]/30 p-6">
            <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Evidence-Based Structure</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Deep work blocks (90–180 min) align with ultradian rhythms. Protected breaks prevent decision fatigue. Movement resets cognition. Reflection encodes learning. This is not a template — it is the default contract.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
