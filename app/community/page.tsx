"use client";
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';

type Post = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(20);
      if (!error && data) setPosts(data as any);
      setLoading(false);
    };
    load();
  }, []);

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

          {loading ? (
            <SkeletonList rows={3} />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="No announcements yet"
              description="Your cohort lead will post updates here as the cohort progresses. You'll get a notification when something new drops."
            />
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 hover:border-neutral-700 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-sm font-extrabold text-amber-100 leading-tight">{post.title}</h3>
                    <span className="shrink-0 text-[10px] text-neutral-500 font-mono">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">{post.body}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
