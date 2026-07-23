"use client";
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type Report = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(20);
      if (!error && data) setReports(data as any);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20 text-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tighter">Reports</h1>
              <p className="text-[10px] text-neutral-500">Admin curated · Cached for offline</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-neutral-500 animate-pulse">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-neutral-800 bg-[#121212]/30 p-8 text-center">
                <p className="text-sm text-neutral-400 mb-2">No reports yet in Supabase</p>
                <p className="text-xs text-neutral-600">Seed example: INSERT INTO reports(title,body) VALUES('Interview Report: Wealth Discipline','...')</p>
              </div>
              {/* Fallback static demo content */}
              {[
                { title: 'Interview Report: Wealth Discipline (Jul 2026)', date: 'Jul 20', body: 'Wealth discipline requires time-boxed deep work...' },
                { title: 'Presentation: The 90-Minute Deep Work Protocol', date: 'Jul 18', body: 'Ultradian rhythm aligned work blocks...' },
                { title: 'Interview: Building Teams That Hold You Accountable', date: 'Jul 15', body: 'Accountability teams of 3-4 outperform solo...' },
              ].map((r) => (
                <div key={r.title} className="block rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-extrabold">{r.title}</h3>
                    <span className="text-[10px] text-neutral-600 font-mono">{r.date}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-3">{r.body}</p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400">CACHED</span>
                    <span>Available offline (demo)</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="block w-full text-left rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6 hover:border-neutral-600 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-extrabold group-hover:text-amber-200 transition-colors">{r.title}</h3>
                    <span className="text-[10px] text-neutral-600 font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-neutral-500 line-clamp-2">{r.body.slice(0,120)}...</p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-2">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400">CACHED</span>
                    <span>Available offline</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setSelected(null)}>
              <div className="max-w-2xl w-full rounded-2xl border border-neutral-800 bg-[#121212] p-8" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-2">{selected.title}</h2>
                <p className="text-xs text-neutral-500 mb-4">{new Date(selected.created_at).toLocaleString()}</p>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{selected.body}</p>
                <button onClick={() => setSelected(null)} className="mt-6 h-9 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-white">Close</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
