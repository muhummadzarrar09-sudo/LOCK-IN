"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Users, Flame, Trophy, Award, Clock, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Skeleton, SkeletonList } from '@/components/Skeleton';
import { usePagination, LoadMoreSentinel } from '@/lib/pagination';
import { initials } from '@/lib/ui';

type Member = {
  id: string;
  username: string;
  role: string;
  streak: number;
  best_streak: number;
  rank: number;
  achievements_count: number;
  created_at?: string;
};

const PAGE_SIZE = 24;

type SortKey = 'rank' | 'best' | 'achievements' | 'recent';

const SORT_OPTIONS: { id: SortKey; label: string; icon: any }[] = [
  { id: 'rank', label: 'By streak', icon: Flame },
  { id: 'best', label: 'By best streak', icon: Trophy },
  { id: 'achievements', label: 'By badges', icon: Award },
  { id: 'recent', label: 'Recently joined', icon: Clock },
];

export default function PeoplePage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rank');
  const [sortOpen, setSortOpen] = useState(false);
  const [activeToday, setActiveToday] = useState<number | null>(null);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);

  const fetcher = useCallback(async (page: number, pageSize: number) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Choose the right source based on sort key
    if (sort === 'recent') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      let rows = (data || []) as any[];
      if (query.trim()) {
        const q = query.toLowerCase();
        rows = rows.filter((m) => m.username.toLowerCase().includes(q));
      }
      // Hydrate streaks + achievements for these rows
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const [{ data: streaksData }, { data: achData }] = await Promise.all([
          supabase.from('streaks').select('user_id, current_streak, best_streak').in('user_id', ids),
          supabase.from('achievements').select('user_id').in('user_id', ids),
        ]);
        const streakMap = new Map((streaksData || []).map((s: any) => [s.user_id, s]));
        const achMap = new Map<string, number>();
        (achData || []).forEach((a: any) => {
          achMap.set(a.user_id, (achMap.get(a.user_id) || 0) + 1);
        });
        rows = rows.map((r: any) => ({
          ...r,
          streak: streakMap.get(r.id)?.current_streak || 0,
          best_streak: streakMap.get(r.id)?.best_streak || 0,
          achievements_count: achMap.get(r.id) || 0,
          rank: 0,
        }));
      }
      return { rows: rows as Member[], hasMore: rows.length === pageSize };
    }

    // Default + best/achievements: leaderboard-driven
    const orderCol =
      sort === 'best' ? 'best_streak' : 'current_streak';
    const { data, error } = await supabase
      .from('leaderboard')
      .select('id, username, role, streak, best_streak, rank')
      .order(orderCol, { ascending: false })
      .range(from, to);
    if (error) throw error;

    let rows = (data || []) as any[];

    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((m) => m.username.toLowerCase().includes(q));
    }

    if (rows.length > 0) {
      const { data: achCounts } = await supabase
        .from('achievements')
        .select('user_id')
        .in('user_id', rows.map((r) => r.id));
      if (achCounts) {
        const countMap = new Map<string, number>();
        (achCounts as any[]).forEach((a) => {
          countMap.set(a.user_id, (countMap.get(a.user_id) || 0) + 1);
        });
        rows = rows.map((r) => ({ ...r, achievements_count: countMap.get(r.id) || 0 }));
      }
      // If sorting by achievements, re-rank client-side (cheap for one page of 24)
      if (sort === 'achievements') {
        rows.sort((a, b) => (b.achievements_count || 0) - (a.achievements_count || 0));
      }
    }

    return { rows: rows as Member[], hasMore: rows.length === pageSize };
  }, [query, sort]);

  const { rows, loading, loadingMore, hasMore, loadMore, error, refresh } = usePagination<Member>({ fetcher, pageSize: PAGE_SIZE });

  // Reset pagination when sort changes
  useEffect(() => {
    refresh();
  }, [sort, refresh]);

  // Load activity pulse once on mount (doesn't need to refresh with sort/search)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const todayISO = new Date().toISOString().slice(0, 10);
        const [{ count: totalCount }, { data: todayCheckIns }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'member'),
          supabase.from('check_ins').select('user_id').gte('completed_at', `${todayISO}T00:00:00Z`),
        ]);
        if (!cancelled) {
          setTotalMembers(totalCount || null);
          if (todayCheckIns) {
            setActiveToday(new Set((todayCheckIns as any[]).map(c => c.user_id)).size);
          }
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentSort = SORT_OPTIONS.find((o) => o.id === sort) || SORT_OPTIONS[0];
  const SortIcon = currentSort.icon;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
        <div className="max-w-3xl mx-auto px-5 md:px-6 pt-8 md:pt-12 pb-24">
          <PageHeader
            icon={Users}
            title="Members"
            subtitle={`${rows.length} member${rows.length === 1 ? '' : 's'}${query ? ` matching "${query}"` : ''}`}
          />

          {activeToday !== null && totalMembers !== null && totalMembers > 0 && (
            <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/20 border border-emerald-800/30 text-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              {activeToday} active today
            </div>
          )}

          {/* Search + sort row */}
          <div className="flex items-stretch gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username…"
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="h-11 px-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs font-bold text-neutral-300 hover:border-neutral-700 transition-colors"
                aria-haspopup="menu"
                aria-expanded={sortOpen}
              >
                <SortIcon className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">{currentSort.label}</span>
                <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} aria-hidden="true" />
                  <div
                    role="menu"
                    className="absolute right-0 top-12 z-40 min-w-[180px] rounded-lg border border-neutral-800 bg-[#121212] shadow-2xl shadow-black/50 py-1.5 fade-in-up"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const OptIcon = opt.icon;
                      const active = opt.id === sort;
                      return (
                        <button
                          key={opt.id}
                          role="menuitem"
                          onClick={() => { setSort(opt.id); setSortOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${
                            active ? 'bg-amber-500/10 text-amber-200' : 'text-neutral-300 hover:bg-neutral-900/60'
                          }`}
                        >
                          <OptIcon className={`w-3.5 h-3.5 ${active ? 'text-amber-300' : 'text-neutral-500'}`} />
                          <span className="flex-1 text-left">{opt.label}</span>
                          {active && <span className="text-amber-400 text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonList rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query ? 'No matches' : 'No members yet'}
              description={query ? `No one with username "${query}".` : 'Members will appear here once they join the cohort.'}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rows.map((m) => (
                  <Link
                    key={m.id}
                    href={`/u/${m.username}`}
                    className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-4 hover:border-amber-500/40 hover:bg-[#161616] transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400/30 to-amber-700/20 flex items-center justify-center text-xs font-extrabold text-amber-200">
                        {initials(m.username)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-white truncate group-hover:text-amber-200 transition-colors">
                          {m.username}
                        </p>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">
                          {sort === 'rank' ? `#${m.rank || '—'}` : sort === 'recent' ? 'Recent' : sort === 'achievements' ? `${m.achievements_count || 0} badge${(m.achievements_count || 0) === 1 ? '' : 's'}` : `Best ${m.best_streak}d`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span className="text-amber-300 font-extrabold">{m.streak}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-neutral-500" />
                        <span>{m.best_streak}</span>
                      </span>
                      {m.achievements_count > 0 && (
                        <span className="text-amber-300/80">★ {m.achievements_count}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <LoadMoreSentinel onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
