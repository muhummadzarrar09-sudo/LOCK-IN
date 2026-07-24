"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Search, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { usePagination, LoadMoreSentinel } from '@/lib/pagination';
import { useRealtimeTable } from '@/lib/realtime';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type LeaderEntry = {
  id: string;
  username: string;
  streak: number;
  rank: number;
  role: string;
};

const PAGE_SIZE = 30;

export default function LeaderboardPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [cohortAvg, setCohortAvg] = useState(0);
  const [activeToday, setActiveToday] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);

  const fetcher = useCallback(async (page: number, pageSize: number) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    // When searching: query a wide range and filter server-side-ish (we still
    // do client filter below, but we pull a much bigger window so users
    // beyond the first 30 are findable).
    const useWideRange = debouncedQuery.trim().length > 0;
    const rangeFrom = useWideRange ? 0 : from;
    const rangeTo = useWideRange ? 999 : to;
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .range(rangeFrom, rangeTo);
    if (error) throw error;

    // First page: also fetch session + compute cohort avg
    if (page === 0) {
      const [{ data: { session } }] = await Promise.all([supabase.auth.getSession()]);
      if (session) setCurrentUserId(session.user.id);
      // Cohort avg: use the full count from a quick count query
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member');
      const { data: allStreaks } = await supabase.from('streaks').select('current_streak');
      const total = (allStreaks || []).reduce((s, x: any) => s + (x.current_streak || 0), 0);
      const denom = count || (allStreaks?.length || 1);
      setCohortAvg(Math.round((total / denom) * 10) / 10);
      setTotalMembers(count || null);

      // Active today = unique users with check_ins today
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data: todayCheckIns } = await supabase
        .from('check_ins')
        .select('user_id')
        .gte('completed_at', `${todayISO}T00:00:00Z`);
      if (todayCheckIns) {
        setActiveToday(new Set((todayCheckIns as any[]).map(c => c.user_id)).size);
      }
    }

    // Client-side filter applied to the wide range, then we paginate from
    // the filtered set. This way a user can find anyone whose rank is
    // beyond page 1.
    let out = (data || []) as LeaderEntry[];
    if (useWideRange) {
      const q = debouncedQuery.toLowerCase();
      out = out.filter((e) => e.username.toLowerCase().includes(q));
      // Apply requested page slice
      out = out.slice(from, from + pageSize);
    }

    return { rows: out, hasMore: useWideRange ? out.length === pageSize : (data || []).length === pageSize };
  }, [debouncedQuery]);

  const { rows, loading, loadingMore, hasMore, loadMore, error, refresh } = usePagination<LeaderEntry>({
    fetcher,
    pageSize: PAGE_SIZE,
  });

  // Real-time: refresh when streaks change
  useRealtimeTable('streaks', '*', () => { refresh(); }, undefined, [refresh]);

  // Reset pagination when search query changes (so wide-range search
  // returns the first page of matches, not the existing paged results).
  useEffect(() => {
    refresh();
  }, [debouncedQuery, refresh]);

  // The fetcher already filters when query is set. The rows returned
  // are already the right slice.
  const filtered = rows;

  const myEntry = currentUserId ? rows.find((e) => e.id === currentUserId) : null;
  const topThree = filtered.slice(0, 3);
  const rest = filtered.slice(3);

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

          {activeToday !== null && totalMembers !== null && totalMembers > 0 && (
            <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/20 border border-emerald-800/30 text-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <Activity className="w-3 h-3" />
              {activeToday} of {totalMembers} active today
            </div>
          )}

          {myEntry && (
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-700/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-1">Your rank</p>
                  <p className="text-3xl font-black text-amber-100">
                    #{myEntry.rank} <span className="text-sm text-amber-300/70 font-bold">of {rows.length}+</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-1">Streak</p>
                  <p className="text-2xl font-black text-amber-200">{myEntry.streak}</p>
                </div>
              </div>
            </div>
          )}

          {rows.length > 0 && (
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

          {error && (
            <div className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonList rows={8} />
          ) : rows.length === 0 ? (
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
              {topThree.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Top of cohort</h2>
                  <Podium entries={topThree} currentUserId={currentUserId} />
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">The cohort</h2>
                  <div className="space-y-1.5">
                    {rest.map((e) => (
                      <Link
                        key={e.id}
                        href={`/u/${e.username}`}
                        className={`flex justify-between items-center rounded-lg px-3 py-2.5 border hover:opacity-80 transition-opacity ${
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
                      </Link>
                    ))}
                  </div>
                  <LoadMoreSentinel onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore} />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Podium: 2nd, 1st, 3rd in classic Olympic order
// ─────────────────────────────────────────────────────────────────────────────

type PodiumEntry = { id: string; username: string; streak: number; rank: number };

function Podium({ entries, currentUserId }: { entries: PodiumEntry[]; currentUserId: string | null }) {
  // Reorder to [2nd, 1st, 3rd] for the visual podium
  const second = entries.find((e) => e.rank === 2);
  const first = entries.find((e) => e.rank === 1);
  const third = entries.find((e) => e.rank === 3);
  const ordered = [second, first, third].filter(Boolean) as PodiumEntry[];

  if (ordered.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {ordered.map((e) => (
        <PodiumColumn
          key={e.id}
          entry={e}
          isFirst={e.rank === 1}
          isYou={e.id === currentUserId}
        />
      ))}
    </div>
  );
}

function PodiumColumn({ entry, isFirst, isYou }: { entry: PodiumEntry; isFirst: boolean; isYou: boolean }) {
  // Heights reflect rank
  const heightClass = isFirst
    ? 'h-32 sm:h-36'
    : entry.rank === 2
    ? 'h-24 sm:h-28'
    : 'h-20 sm:h-24';

  const ringColor = isFirst
    ? 'from-amber-400 to-amber-600'
    : entry.rank === 2
    ? 'from-neutral-300 to-neutral-500'
    : 'from-amber-700 to-amber-900';

  const bgGradient = isFirst
    ? 'from-amber-500/20 via-amber-600/10 to-amber-700/5'
    : entry.rank === 2
    ? 'from-neutral-300/10 via-neutral-400/5 to-transparent'
    : 'from-amber-700/15 via-amber-800/5 to-transparent';

  return (
    <Link
      href={`/u/${entry.username}`}
      className="flex flex-col items-center group"
      aria-label={`Rank ${entry.rank}: ${entry.username}, ${entry.streak}-day streak`}
    >
      {/* Avatar circle */}
      <div
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-sm sm:text-base font-extrabold text-black bg-gradient-to-br ${ringColor} mb-2 group-hover:scale-105 transition-transform`}
        style={{
          boxShadow: isFirst
            ? '0 0 0 4px rgba(251, 191, 36, 0.15), 0 8px 30px -6px rgba(251, 191, 36, 0.4)'
            : '0 0 0 3px rgba(255, 255, 255, 0.05)',
        }}
      >
        {initials(entry.username)}
        {isFirst && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Crown className="w-5 h-5 text-amber-300 drop-shadow" strokeWidth={2.2} fill="currentColor" fillOpacity={0.15} />
          </div>
        )}
        {isYou && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider uppercase bg-amber-400 text-black shadow">
            You
          </span>
        )}
      </div>
      <p className={`text-[11px] sm:text-xs font-extrabold truncate max-w-full ${isYou ? 'text-amber-100' : 'text-white'}`}>
        {entry.username}
      </p>
      <p className="text-[10px] text-neutral-500 font-mono mb-2">#{entry.rank}</p>

      {/* Streak box */}
      <div
        className={`w-full ${heightClass} rounded-t-xl bg-gradient-to-b ${bgGradient} border border-b-0 border-neutral-800/60 flex flex-col items-center justify-end pb-2 px-1`}
      >
        <p className={`text-2xl sm:text-3xl font-black leading-none ${isFirst ? 'text-amber-200' : entry.rank === 2 ? 'text-neutral-200' : 'text-amber-700/80'}`}>
          {entry.streak}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold mt-0.5">days</p>
      </div>
    </Link>
  );
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
