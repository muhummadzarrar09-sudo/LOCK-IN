"use client";
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type Post = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

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
      <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tighter">Community</h1>
              <p className="text-[10px] text-neutral-500">Read-only mirror · Live</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-neutral-500 animate-pulse">Loading feed...</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
              <p className="text-xs text-neutral-500 uppercase tracking-[0.2em] mb-4">Read-Only Mirror</p>
              <h2 className="text-base font-extrabold mb-3">Cohort Announcements</h2>
              <div className="text-left space-y-4 text-sm text-neutral-300">
                <div className="border-b border-neutral-800 pb-3">
                  <h4 className="font-bold text-amber-200 mb-1">New Cohort Start: Aug 1</h4>
                  <p className="text-xs text-neutral-500">Prepare your schedule template. Deep work blocks begin at 06:00 local time.</p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Reminder: Check-ins are active</h4>
                  <p className="text-xs text-neutral-500">Missed blocks break streaks. Team visibility is live.</p>
                </div>
              </div>
              <p className="mt-6 text-[11px] text-neutral-600">Seed via: INSERT INTO community_posts(title,body) VALUES('Announcement','...')</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
                  <h3 className="text-sm font-bold text-amber-200 mb-2">{post.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-2">{post.body}</p>
                  <span className="text-[10px] text-neutral-600 font-mono">{new Date(post.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
