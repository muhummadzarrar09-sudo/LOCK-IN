"use client";
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type LeaderEntry = {
  id: string;
  username: string;
  streak: number;
  rank: number;
  role: string;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setCurrentUserId(session.user.id);

        // Try view first
        const { data: viewData, error: viewError } = await supabase.from('leaderboard').select('*').order('rank', { ascending: true }).limit(50);
        if (!viewError && viewData && viewData.length > 0) {
          setEntries(viewData as any);
        } else {
          // Fallback: join profiles + streaks
          const { data: profiles } = await supabase.from('profiles').select('id,username,role').eq('role','member');
          const { data: streaks } = await supabase.from('streaks').select('user_id,current_streak');
          const streakMap = new Map((streaks||[]).map((s:any) => [s.user_id, s.current_streak]));
          const combined = (profiles||[]).map((p:any) => ({
            id: p.id,
            username: p.username,
            streak: streakMap.get(p.id) || 0,
            role: p.role,
            rank: 0,
          })).sort((a,b) => b.streak - a.streak || a.username.localeCompare(b.username))
            .map((e,i) => ({ ...e, rank: i+1 }));
          setEntries(combined);
        }
      } catch (e) {
        console.warn('leaderboard load', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tighter">Leaderboard</h1>
              <p className="text-[10px] text-neutral-500">Ranked by streak · Live from Supabase</p>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
            <h2 className="text-sm font-extrabold mb-2">Ranked by Streak</h2>
            <p className="text-xs text-neutral-500 mb-6">Only members with active check-ins appear. Your rank updates in real time.</p>
            {loading ? (
              <div className="text-sm text-neutral-500 animate-pulse">Loading leaderboard...</div>
            ) : entries.length === 0 ? (
              <div className="text-sm text-neutral-500">No members yet. Be first to build a streak in dashboard.</div>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <div key={e.id} className={`flex justify-between items-center border-b border-neutral-800 pb-2 px-3 py-2 rounded-lg ${e.id === currentUserId ? 'bg-amber-950/20 border-amber-900/30' : ''}`}>
                    <span className="text-sm flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-600 w-6">{e.rank}.</span>
                      <span className={e.id === currentUserId ? 'text-amber-200 font-bold' : 'text-neutral-300'}>{e.username}</span>
                      {e.id === currentUserId && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">YOU</span>}
                    </span>
                    <span className="text-amber-300 font-black text-sm">{e.streak}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
