"use client";
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Flame, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DEFAULT_BLOCKS = [
  { id: 'b1', label: 'Deep Work Block 1', block_type: 'work' as const, start: '06:00', end: '09:00', completed: false },
  { id: 'b2', label: 'Protected Break', block_type: 'break' as const, start: '09:00', end: '09:30', completed: false },
  { id: 'b3', label: 'Deep Work Block 2', block_type: 'work' as const, start: '09:30', end: '12:00', completed: false },
  { id: 'b4', label: 'Movement', block_type: 'movement' as const, start: '12:00', end: '12:30', completed: false },
  { id: 'b5', label: 'Reflection / Journal', block_type: 'reflection' as const, start: '12:30', end: '13:00', completed: false },
  { id: 'b6', label: 'Deep Work Block 3', block_type: 'work' as const, start: '13:00', end: '16:00', completed: false },
];

export default function DashboardPage() {
  const [blocks, setBlocks] = useState(DEFAULT_BLOCKS);
  const [streak, setStreak] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [today, setToday] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setUserEmail(session.user.email);
      // Load streak from DB if exists
      const { data } = await supabase.from('streaks').select('current_streak').eq('user_id', session?.user?.id).single();
      if (data) setStreak(data.current_streak);
    };
    loadData();
  }, []);

  const handleCheckIn = async (blockId: string) => {
    const newBlocks = blocks.map(b => b.id === blockId ? { ...b, completed: !b.completed } : b);
    setBlocks(newBlocks);

    // Persist to DB
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const completedBlock = newBlocks.find(b => b.id === blockId);
    if (completedBlock?.completed) {
      await (supabase.from('check_ins') as any).upsert({
        user_id: session.user.id,
        time_block_id: blockId,
        completed_at: new Date().toISOString(),
        missed: false,
      }, { onConflict: 'user_id,time_block_id', ignoreDuplicates: false }).select();
    }
  };

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-20">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tighter">Daily Schedule</h1>
              <p className="text-xs text-neutral-500 mt-1">{today} · {timezone}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Streak</div>
                <div className="text-xl font-black text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-5 h-5" /> {streak}
                </div>
              </div>
            </div>
          </div>
          <div className="h-px bg-neutral-800 w-full" />
        </header>

        {/* Alert Banner */}
        <div className="mb-8 rounded-xl bg-gradient-to-r from-amber-900/20 to-amber-950/20 border border-amber-900/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm mb-1">Accountability Active</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                You are in the active cohort. Missing any block breaks your streak visibly. Your team and leaderboard will reflect it immediately. No excuses.
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Blocks */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-4">Today's Blocks</h2>
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
              <h3 className={`text-base font-bold mb-1 ${block.completed ? 'text-amber-100' : 'text-text-primary'}`}>
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

        {/* Evidence Note */}
        <section className="mt-12 rounded-2xl border border-neutral-800 bg-[#121212]/30 p-6">
          <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Evidence-Based Structure</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Deep work blocks (90–180 min) align with ultradian rhythms. Protected breaks prevent decision fatigue. Movement resets cognition. Reflection encodes learning. This is not a template — it is the default contract.
          </p>
        </section>
      </div>
    </main>
  );
}
