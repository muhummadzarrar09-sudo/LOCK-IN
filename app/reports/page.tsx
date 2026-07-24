"use client";
import { useState, useEffect, useCallback } from 'react';
import { FileText, Clock, X, Search, CheckCircle2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { usePagination, LoadMoreSentinel } from '@/lib/pagination';
import { FreshnessDot } from '@/components/FreshnessDot';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

type Report = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const PAGE_SIZE = 20;

function reportType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('interview') || t.includes('conversation')) return 'INTERVIEW';
  if (t.includes('protocol') || t.includes('framework') || t.includes('manifesto') || t.includes('guide')) return 'FRAMEWORK';
  if (t.includes('outperform') || t.includes('case') || t.includes('data')) return 'CASE STUDY';
  return 'FRAMEWORK';
}

function readingTime(body: string): string {
  const words = body.split(/\s+/).length;
  const min = Math.max(1, Math.round(words / 220));
  return `${min} min read`;
}

export default function ReportsPage() {
  const [selected, setSelected] = useState<Report | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const fetcher = useCallback(async (page: number, pageSize: number) => {
    const useWideRange = debouncedQuery.trim().length > 0;
    let data: any[] = [];
    if (useWideRange) {
      // Search is routed through a server endpoint so we can validate, rate
      // limit, and keep PostgREST filter construction off the client.
      const q = debouncedQuery.trim();
      const res = await fetch(`/api/search?type=reports&q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`);
      if (!res.ok) throw new Error('Search failed');
      const payload = await res.json();
      data = payload.reports || [];
    } else {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data: byDate, error: e2 } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (e2) throw e2;
      data = byDate || [];
    }
    return { rows: data as Report[], hasMore: data.length === pageSize };
  }, [debouncedQuery]);

  const { rows, loading, loadingMore, hasMore, loadMore, error, refresh } = usePagination<Report>({ fetcher, pageSize: PAGE_SIZE });

  // Reset pagination when search query changes
  useEffect(() => {
    refresh();
  }, [debouncedQuery, refresh]);

  const filtered = rows;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-3xl mx-auto">
          <PageHeader
            icon={FileText}
            title="Field Notes"
            subtitle="Read less. Apply more. Curated for execution."
          />

          <div className="mb-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search field notes…"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <SkeletonList rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="First field note drops soon"
              description="Your cohort lead will publish execution notes here. The goal is application, not consumption."
            />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
              <p className="text-sm text-neutral-300 mb-1 font-semibold">No reports match &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-500">Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const type = reportType(r.title);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="block w-full text-left rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 md:p-6 hover:border-amber-500/30 hover:bg-[#161616] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-[9px] font-extrabold tracking-[0.2em] text-amber-300 uppercase">{type}</span>
                      <span className="text-[10px] text-neutral-500 inline-flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" /> {readingTime(r.body)}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-200 transition-colors mb-2 leading-tight">
                      {r.title}
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2 mb-3">
                      {r.body.slice(0, 160)}…
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-600 font-mono inline-flex items-center gap-1.5">
                        <FreshnessDot iso={r.created_at} />
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300/80 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Apply this
                      </span>
                    </div>
                  </button>
                );
              })}
              <LoadMoreSentinel onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore} />
            </div>
          )}
        </div>
      </main>

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-[#121212] p-6 md:p-8 shadow-2xl fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold tracking-[0.2em] text-amber-300 uppercase">{reportType(selected.title)}</span>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mt-1 leading-tight">{selected.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
                  <span>{new Date(selected.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span>·</span>
                  <span>{readingTime(selected.body)}</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 shrink-0 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <div className="border-t border-neutral-800 pt-4 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
              {selected.body}
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-800 flex flex-wrap gap-2">
              <button className="h-9 px-3 rounded-lg bg-amber-300 text-black text-xs font-black inline-flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark as applied
              </button>
              <a href="/team" className="h-9 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-bold inline-flex items-center gap-2 hover:border-amber-500/30 hover:text-amber-200 transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> Discuss with squad
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
