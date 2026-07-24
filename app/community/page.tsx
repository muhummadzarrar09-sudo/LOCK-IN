"use client";
import { useState, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { usePagination, LoadMoreSentinel } from '@/lib/pagination';
import { relativeTime } from '@/lib/ui';
import { FreshnessDot } from '@/components/FreshnessDot';

type Post = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const PAGE_SIZE = 20;

export default function CommunityPage() {
  const fetcher = useCallback(async (page: number, pageSize: number) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: (data || []) as Post[], hasMore: (data || []).length === pageSize };
  }, []);

  const { rows, loading, loadingMore, hasMore, loadMore, error } = usePagination<Post>({ fetcher, pageSize: PAGE_SIZE });

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-2xl mx-auto">
          <PageHeader
            icon={MessageCircle}
            title="Community"
            subtitle="Updates from your cohort lead"
          />

          {error && (
            <div className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonList rows={3} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No announcements yet"
              description="Your cohort lead will post updates here as the cohort progresses. You'll get a notification when something new drops."
            />
          ) : (
            <div className="space-y-3">
              {rows.map((post) => (
                <article key={post.id} className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 hover:border-neutral-700 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-extrabold text-amber-100 leading-tight">{post.title}</h3>
                    <span className="shrink-0 text-[10px] text-neutral-500 font-mono inline-flex items-center gap-1.5">
                      <FreshnessDot iso={post.created_at} />
                      {relativeTime(post.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">{post.body}</p>
                </article>
              ))}
              <LoadMoreSentinel onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
