"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Trophy, Crown, Medal, Award, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { useRealtimeTable } from '@/lib/realtime';

type LeaderEntry = {
  id: string;
  username: string;
  streak: number;
  rank: number;
  role: string;
};

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-4 h-4 text-amber-300" strokeWidth={2.2} />;
  if (rank === 2) return <Medal className="w-4 h-4 text-neutral-300" strokeWidth={2.2} />;
  if (rank === 3) return <Award className="w-4 h-4 text-amber-600" strokeWidth={2.2} />;
  return null;
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-gradient-to-r from-amber-500/15 to-amber-700/10 border-amber-500/40';
  if (rank === 2) return 'bg-gradient-to-r from-neutral-300/10 to-transparent border-neutral-300/20';
  if (rank === 3) return 'bg-gradient-to-r from-amber-700/15 to-transparent border-amber-700/30';
  return 'bg-[#121212]/60 border-neutral-800';
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);

      const { data: viewData, error: viewError } = await supabase.from('leaderboard').select('*').order('rank', { ascending: true }).limit(50);
      if (!viewError && viewData && viewData.length > 0) {
        setEntries(viewData as any);
      } else {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time: refresh when any streak updates
  useRealtimeTable('streaks', '*', () => { load(); }, undefined, [load]);

  const myEntry = currentUserId ? entries.find(e => e.id === currentUserId) : null;

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(e => e.username.toLowerCase().includes(q));
  }, [entries, query]);

  const topThree = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const cohortAvg = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.streak, 0) / entries.length)
    : 0;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-2xl mx-auto">
          <PageHeader
            icon={Trophy}
            title="Leaderboard"
            subtitle={`Ranked by streak · Cohort average: ${cohortAvg} day${cohortAvg === 1 ? '' : 's'}`}
          />

          {/* Your rank pinned card */}
          {myEntry && (
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-700/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-1">Your rank</p>
                  <p className="text-3xl font-black text-amber-100">
                    #{myEntry.rank} <span className="text-sm text-amber-300/70 font-bold">of {entries.length}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-1">Streak</p>
                  <p className="text-2xl font-black text-amber-200">{myEntry.streak}</p>
                </div>
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="mb-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username…"
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
          )}

          {loading ? (
            <SkeletonList rows={5} />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No streaks yet"
              description="Be the first to check in. Your name will land at the top of this board."
              primaryAction={{ label: 'Check in now', href: '/dashboard' }}
            />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
              <p className="text-sm text-neutral-300 mb-1 font-semibold">No one named &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-500">Try a different search term.</p>
            </div>
          ) : (
            <>
              {/* Top 3 with special treatment */}
              {topThree.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Top of cohort</h2>
                  <div className="space-y-2">
                    {topThree.map((e) => (
                      <div key={e.id} className={`rounded-xl border p-4 flex items-center justify-between ${rankStyle(e.rank)}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
                            {rankIcon(e.rank) || <span className="text-xs font-mono text-neutral-500">{e.rank}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-extrabold truncate ${e.id === currentUserId ? 'text-amber-100' : 'text-white'}`}>
                              {e.username}
                              {e.id === currentUserId && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">YOU</span>}
                            </p>
                          </div>
                        </div>
                        <span className="text-amber-300 font-black text-sm shrink-0 ml-2">{e.streak}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rest of leaderboard */}
              {rest.length > 0 && (
                <div>
                  <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">The cohort</h2>
                  <div className="space-y-1.5">
                    {rest.map((e) => (
                      <div
                        key={e.id}
                        className={`flex justify-between items-center rounded-lg px-3 py-2.5 border ${
                          e.id === currentUserId
                            ? 'bg-amber-950/15 border-amber-900/30'
                            : 'bg-[#121212]/40 border-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[11px] font-mono text-neutral-600 w-6 text-right">{e.rank}.</span>
                          <span className={`text-sm truncate ${e.id === currentUserId ? 'text-amber-100 font-bold' : 'text-neutral-300'}`}>
                            {e.username}
                            {e.id === currentUserId && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">YOU</span>}
                          </span>
                        </div>
                        <span className="text-amber-300/90 font-extrabold text-sm shrink-0">{e.streak}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
