'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type UsePaginationOpts<T> = {
  /** Function that fetches a page. Receives (page, pageSize) and returns rows + hasMore. */
  fetcher: (page: number, pageSize: number) => Promise<{ rows: T[]; hasMore: boolean }>;
  pageSize?: number;
  initialRows?: T[];
};

type UsePaginationReturn<T> = {
  rows: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  page: number;
  loadMore: () => void;
  refresh: () => void;
};

/**
 * Cursor-style pagination hook.
 * - First page loads eagerly (or via initialRows).
 * - loadMore() fetches the next page and appends.
 * - Stops when fetcher returns hasMore=false.
 */
export function usePagination<T>({
  fetcher,
  pageSize = 20,
  initialRows = [],
}: UsePaginationOpts<T>): UsePaginationReturn<T> {
  const [rows, setRows] = useState<T[]>(initialRows);
  const [page, setPage] = useState(initialRows.length > 0 ? 1 : 0);
  const [loading, setLoading] = useState(initialRows.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (pageNum: number, replace = false) => {
    try {
      if (pageNum === 0) setLoading(true); else setLoadingMore(true);
      const { rows: newRows, hasMore: more } = await fetcherRef.current(pageNum, pageSize);
      if (!mounted.current) return;
      setRows((prev) => replace ? newRows : [...prev, ...newRows]);
      setHasMore(more);
      setPage(pageNum);
      setError(null);
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Failed to load');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [pageSize]);

  // Initial load
  useEffect(() => {
    mounted.current = true;
    if (initialRows.length === 0) load(0);
    return () => { mounted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    load(page + 1);
  }, [load, page, loading, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    setRows([]);
    setHasMore(true);
    setPage(0);
    load(0, true);
  }, [load]);

  return { rows, loading, loadingMore, hasMore, error, page, loadMore, refresh };
}

export function LoadMoreSentinel({ onLoadMore, hasMore, loadingMore }: { onLoadMore: () => void; hasMore: boolean; loadingMore: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="py-6 flex items-center justify-center text-neutral-500 text-xs">
      {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scroll to load more'}
    </div>
  );
}
