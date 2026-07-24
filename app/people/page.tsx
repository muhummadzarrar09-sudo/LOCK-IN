"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Users, Flame, Trophy } from 'lucide-react';
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
};

const PAGE_SIZE = 24;

export default function PeoplePage() {
  const [query, setQuery] = useState('');

  const fetcher = useCallback(async (page: number, pageSize: number) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    // Use leaderboard view for ranking + streaks
    const { data, error } = await supabase
      .from('leaderboard')
      .select('id, username, role, streak, best_streak, rank')
      .order('rank', { ascending: true })
      .range(from, to);
    if (error) throw error;

    let rows = (data || []) as any[];

    // Client-side filter by query (cheap, in-memory)
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((m) => m.username.toLowerCase().includes(q));
    }

    // Fetch achievement counts in batch
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
    }

    return { rows: rows as Member[], hasMore: rows.length === pageSize };
  }, [query]);

  const { rows, loading, loadingMore, hasMore, loadMore, error } = usePagination<Member>({ fetcher, pageSize: PAGE_SIZE });

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

          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username…"
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
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
                        <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">#{m.rank}</p>
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
