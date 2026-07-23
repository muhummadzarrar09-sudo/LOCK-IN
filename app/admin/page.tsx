"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, LogOut, Users, FileText, MessageCircle, Plus, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type Profile = { id: string; username: string; email: string; role: string; created_at?: string };

export default function AdminPage() {
  const router = useRouter();
  const [cohort, setCohort] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', enrollment_open: true });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [reportForm, setReportForm] = useState({ title: '', body: '' });
  const [communityForm, setCommunityForm] = useState({ title: '', body: '' });
  const [teamForm, setTeamForm] = useState({ name: '', startup_title: '', startup_pitch: '' });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login?redirect=/admin');
          return;
        }
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role,email').eq('id', session.user.id).maybeSingle();
        if (profileError || !profile) {
          setError(`Profile not found: ${profileError?.message || 'no row'}. Run fix-auth-and-admin.sql`);
        }
        const userRole = (profile as any)?.role;
        setRole(userRole || null);
        if (userRole !== 'admin') {
          setError(`Access denied. Current role: ${userRole || 'none'}. Set role='admin' in profiles.`);
        }
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authLoading) {
      loadCohort();
      loadProfiles();
    }
  }, [authLoading]);

  const loadCohort = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('cohorts').select('*').order('start_date', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setCohort(data);
        setForm({
          name: (data as any).name || '',
          start_date: (data as any).start_date || '',
          end_date: (data as any).end_date || '',
          enrollment_open: (data as any).enrollment_open ?? true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    setProfilesLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setProfiles(data as any);
    setProfilesLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohort) {
      const { data, error } = await supabase.from('cohorts').insert({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        enrollment_open: form.enrollment_open,
      }).select().maybeSingle();
      if (error) alert(`Error creating cohort: ${error.message}`);
      else {
        setCohort(data);
        alert('Cohort created!');
      }
      return;
    }
    const { error } = await supabase.from('cohorts').update({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      enrollment_open: form.enrollment_open,
    }).eq('id', cohort.id);
    if (error) alert(`Error: ${error.message}`);
    else {
      alert('Saved');
      loadCohort();
    }
  };

  const handleRoleToggle = async (p: Profile) => {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    if (!confirm(`Change ${p.email} role from ${p.role} to ${newRole}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', p.id);
    if (error) alert(error.message);
    else loadProfiles();
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('reports').insert({
      title: reportForm.title,
      body: reportForm.body,
      author_id: session?.user.id,
    } as any);
    if (error) alert(error.message);
    else {
      alert('Report created');
      setReportForm({ title: '', body: '' });
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('community_posts').insert({
      title: communityForm.title,
      body: communityForm.body,
      author_id: session?.user.id,
    } as any);
    if (error) alert(error.message);
    else {
      alert('Community post created');
      setCommunityForm({ title: '', body: '' });
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('teams').insert({
      name: teamForm.name,
      startup_title: teamForm.startup_title,
      startup_pitch: teamForm.startup_pitch,
      cohort_id: cohort?.id || null,
    } as any);
    if (error) alert(error.message);
    else {
      alert('Team created');
      setTeamForm({ name: '', startup_title: '', startup_pitch: '' });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Checking admin access...</div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20 text-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
                <Settings className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tighter">Admin Panel</h1>
                <p className="text-[10px] text-neutral-500 tracking-wide">Manage cohorts, users, reports, community, teams {role && `· ${role}`}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-700">
              <LogOut className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-900/20 border border-red-900/40 px-5 py-4">
              <h4 className="text-sm font-bold text-red-300 mb-1">Admin Access Issue</h4>
              <p className="text-xs text-red-200/80 leading-relaxed">{error}</p>
              <div className="mt-3 text-[11px] text-neutral-400 leading-relaxed bg-black/30 rounded-lg p-3">
                <div className="font-bold text-neutral-300 mb-1">Fix in Supabase SQL Editor → Run fix-auth-and-admin.sql</div>
                <pre className="whitespace-pre-wrap break-words">profiles row id must equal auth.users id, role='admin'</pre>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {/* Cohort */}
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
              <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Cohort Management</h3>
              {loading ? (
                <div className="text-sm text-neutral-500">Loading...</div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase">Cohort Name</label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white" placeholder="Aug 2026 Cohort" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase">Start Date</label>
                      <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 mb-1.5 uppercase">End Date</label>
                      <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white" />
                    </div>
                    <div className="flex items-center gap-3 pt-5">
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input type="checkbox" checked={form.enrollment_open} onChange={e => setForm({ ...form, enrollment_open: e.target.checked })} className="w-4 h-4 rounded" />
                        Enrollment Open
                      </label>
                    </div>
                  </div>
                  <button type="submit" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs tracking-wide hover:bg-amber-300"><Save className="w-3.5 h-3.5" /> Save Cohort</button>
                </form>
              )}
            </section>

            {/* Users */}
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-neutral-500" />
                <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Users & Roles</h3>
                <span className="ml-auto text-[10px] text-neutral-600">{profiles.length} total</span>
              </div>
              {profilesLoading ? (
                <div className="text-xs text-neutral-500 animate-pulse">Loading profiles...</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto pr-1">
                  {profiles.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-neutral-900/50 border border-neutral-800 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                          {p.username}
                          {p.role === 'admin' && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px]"><Shield className="w-3 h-3" />ADMIN</span>}
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate">{p.email}</div>
                      </div>
                      <button onClick={() => handleRoleToggle(p)} className={`ml-3 h-7 px-3 rounded-md text-[10px] font-bold border ${p.role === 'admin' ? 'bg-neutral-800 border-neutral-700 text-neutral-300' : 'bg-amber-400/10 border-amber-900/30 text-amber-300'}`}>
                        {p.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>
                    </div>
                  ))}
                  {profiles.length === 0 && <div className="text-xs text-neutral-600">No profiles. Run fix-auth-and-admin.sql</div>}
                </div>
              )}
            </section>

            {/* Reports */}
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-neutral-500" />
                <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Create Report</h3>
              </div>
              <form onSubmit={handleCreateReport} className="space-y-3">
                <input type="text" required placeholder="Report title" value={reportForm.title} onChange={e => setReportForm({ ...reportForm, title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600" />
                <textarea required placeholder="Body (markdown supported)" value={reportForm.body} onChange={e => setReportForm({ ...reportForm, body: e.target.value })} className="w-full h-24 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600" />
                <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Publish Report</button>
              </form>
            </section>

            {/* Community */}
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-4 h-4 text-neutral-500" />
                <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider">Create Community Post</h3>
              </div>
              <form onSubmit={handleCreateCommunity} className="space-y-3">
                <input type="text" required placeholder="Announcement title" value={communityForm.title} onChange={e => setCommunityForm({ ...communityForm, title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600" />
                <textarea required placeholder="Body" value={communityForm.body} onChange={e => setCommunityForm({ ...communityForm, body: e.target.value })} className="w-full h-24 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600" />
                <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Post Announcement</button>
              </form>
            </section>

            {/* Teams */}
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8">
              <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Create Team</h3>
              <form onSubmit={handleCreateTeam} className="space-y-3">
                <input type="text" required placeholder="Team name" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600" />
                <input type="text" placeholder="Startup title" value={teamForm.startup_title} onChange={e => setTeamForm({ ...teamForm, startup_title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600" />
                <textarea placeholder="Startup pitch" value={teamForm.startup_pitch} onChange={e => setTeamForm({ ...teamForm, startup_pitch: e.target.value })} className="w-full h-20 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600" />
                <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Create Team</button>
              </form>
              <p className="mt-3 text-[11px] text-neutral-600">After creating team, add members via: INSERT INTO team_members(team_id,user_id) VALUES('team_uuid','user_uuid')</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
