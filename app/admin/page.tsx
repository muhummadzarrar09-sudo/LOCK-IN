"use client";
import { useState, useEffect } from 'react';
import { Settings, CalendarDays, UserPlus, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [cohort, setCohort] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', enrollment_open: true });

  useEffect(() => {
    loadCohort();
  }, []);

  const loadCohort = async () => {
    setLoading(true);
    const { data } = await supabase.from('cohorts').select('*').order('start_date', { ascending: false }).limit(1).single();
    if (data) {
      setCohort(data);
      setForm({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        enrollment_open: data.enrollment_open,
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohort) return;
    await supabase.from('cohorts').update({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      enrollment_open: form.enrollment_open,
    }).eq('id', cohort.id);
    loadCohort();
  };

  return (
    <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
            <Settings className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tighter">Admin Panel</h1>
            <p className="text-[10px] text-neutral-500 tracking-wide">Manage cohorts, enrollment, and members</p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 space-y-8">
          {/* Cohort Management — pulled from Supabase */}
          <section>
            <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Cohort Management</h3>
            {loading ? (
              <div className="text-sm text-neutral-500">Loading cohort data...</div>
            ) : cohort ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Cohort Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.enrollment_open}
                        onChange={e => setForm({ ...form, enrollment_open: e.target.checked })}
                        className="w-4 h-4 rounded bg-neutral-900 border-neutral-600 text-amber-400 focus:ring-amber-500/30"
                      />
                      Enrollment Open
                    </label>
                  </div>
                </div>
                <button type="submit" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs tracking-wide hover:bg-amber-300 transition-all">
                  <Save className="w-3.5 h-3.5" /> Save Cohort
                </button>
              </form>
            ) : (
              <div className="text-sm text-neutral-500">No cohort found in database.</div>
            )}
          </section>

          {/* Manual User Assistance */}
          <section className="border-t border-neutral-800 pt-8">
            <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Manual User Assistance</h3>
            <p className="text-sm text-neutral-400 mb-4">If a buyer cannot access their account, assist or manually create/update profiles directly.</p>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); alert('Admin action: check user profile in Supabase.'); }}>
              <input type="email" placeholder="user@email.com" className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60" />
              <button type="submit" className="w-full h-10 rounded-lg bg-amber-400 text-black font-extrabold text-xs tracking-wide hover:bg-amber-300 transition-all">Assist / Update Profile</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
