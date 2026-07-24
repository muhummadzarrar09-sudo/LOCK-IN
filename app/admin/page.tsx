"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, LogOut, Users, FileText, MessageCircle, Plus, Shield, TrendingUp, Activity, BookOpen, Eye, EyeOff, Bug, Clock, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { AnalyticsTab } from '@/components/admin/AnalyticsTab';
import { DemoSeedTab } from '@/components/admin/DemoSeedTab';

type Profile = { id: string; username: string; email: string; role: string; created_at?: string };

type Tab = 'daily' | 'weekly' | 'setup' | 'support' | 'analytics' | 'demo';

export default function AdminPage() {
  const router = useRouter();
  const toast = useToast();
  const [cohort, setCohort] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', enrollment_open: true });

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [streakAvg, setStreakAvg] = useState<number | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [activeToday, setActiveToday] = useState<number | null>(null);
  const [cohortProgress, setCohortProgress] = useState<{
    dayNumber: number;
    total: number;
    pct: number;
    phase: 'pre' | 'running' | 'done';
    activeRate: number;
    healthScore: number; // 0-100 composite
    healthLabel: 'thriving' | 'steady' | 'at risk';
  } | null>(null);

  const [reportForm, setReportForm] = useState({ title: '', body: '' });
  const [communityForm, setCommunityForm] = useState({ title: '', body: '' });
  const [teamForm, setTeamForm] = useState({ name: '', startup_title: '', startup_pitch: '' });

  const [tab, setTab] = useState<Tab>('daily');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; destructive?: boolean; onConfirm: () => void }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [bugReports, setBugReports] = useState<any[]>([]);
  const [bugReportsLoading, setBugReportsLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/login?redirect=/admin');
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('role,email').eq('id', session.user.id).maybeSingle();
        if (!profile) {
          setAccessMessage('Your admin profile is being provisioned. Contact your engineering team if this persists.');
        }
        const userRole = (profile as any)?.role;
        setRole(userRole || null);
        if (userRole !== 'admin') {
          setAccessMessage('You don\'t have admin access. Contact your engineering team to request access.');
        }
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadCohort();
      loadProfiles();
      loadMetrics();
      loadBugReports();
    }
  }, [authLoading, role]);

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

  const loadMetrics = async () => {
    // Streak average
    const { data: streaks } = await supabase.from('streaks').select('current_streak');
    if (streaks && streaks.length > 0) {
      const sum = (streaks as any[]).reduce((s, x) => s + (x.current_streak || 0), 0);
      setStreakAvg(Math.round((sum / streaks.length) * 10) / 10);
    } else {
      setStreakAvg(0);
    }
    // Reports count
    const { count: rCount } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    setReportCount(rCount ?? 0);
    // Active today = users with check_ins today
    const today = new Date().toISOString().slice(0, 10);
    const { data: todays } = await supabase.from('check_ins').select('user_id').gte('completed_at', `${today}T00:00:00Z`);
    if (todays) {
      setActiveToday(new Set((todays as any[]).map(c => c.user_id)).size);
    } else {
      setActiveToday(0);
    }

    // Cohort progress: day X of N + active rate today
    const [{ data: cohortRow }, { count: totalMembers }] = await Promise.all([
      supabase
        .from('cohorts')
        .select('start_date, end_date')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'member'),
    ]);
    if (cohortRow && (cohortRow as any).start_date && (cohortRow as any).end_date) {
      const start = new Date((cohortRow as any).start_date + 'T00:00:00Z');
      const end = new Date((cohortRow as any).end_date + 'T23:59:59Z');
      const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const dayNumber = diffDays + 1;
      const phase: 'pre' | 'running' | 'done' =
        dayNumber < 1 ? 'pre' : dayNumber > total ? 'done' : 'running';
      const pct = Math.max(0, Math.min(100, Math.round((dayNumber / total) * 100)));
      const activeUsers = todays ? new Set((todays as any[]).map(c => c.user_id)).size : 0;
      const activeRate = (totalMembers || 0) > 0
        ? Math.round((activeUsers / (totalMembers || 1)) * 100)
        : 0;
      // Composite health score: 60% from today's activity, 40% from
      // average streak. Streak capped at 30d for normalization.
      const streakComponent = Math.min(100, ((streakAvg || 0) / 30) * 100);
      const activityComponent = activeRate;
      const healthScore = Math.round(activityComponent * 0.6 + streakComponent * 0.4);
      const healthLabel: 'thriving' | 'steady' | 'at risk' =
        healthScore >= 70 ? 'thriving' : healthScore >= 40 ? 'steady' : 'at risk';
      setCohortProgress({
        dayNumber: Math.max(1, Math.min(total, dayNumber)),
        total,
        pct,
        phase,
        activeRate,
        healthScore,
        healthLabel,
      });
    } else {
      setCohortProgress(null);
    }
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
      if (error) {
        toast.error('Could not create cohort. Please try again.');
        return;
      }
      setCohort(data);
      toast.success('Cohort created');
    } else {
      const { error } = await supabase.from('cohorts').update({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        enrollment_open: form.enrollment_open,
      }).eq('id', cohort.id);
      if (error) {
        toast.error('Could not save changes. Please try again.');
        return;
      }
      toast.success('Cohort saved');
      loadCohort();
    }
  };

  const handleRoleToggle = (p: Profile) => {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    setConfirmDialog({
      open: true,
      title: `${newRole === 'admin' ? 'Promote' : 'Demote'} ${p.username}?`,
      message: newRole === 'admin'
        ? `${p.email} will gain full admin access. They can manage cohorts, users, reports, and teams.`
        : `${p.email} will lose admin access and become a regular member.`,
      destructive: newRole !== 'admin',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', p.id);
        if (error) {
          toast.error('Could not update role. Please try again.');
        } else {
          toast.success(`${p.username} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`);
          loadProfiles();
        }
      },
    });
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('reports').insert({
      title: reportForm.title,
      body: reportForm.body,
      author_id: session?.user.id,
    } as any);
    if (error) {
      toast.error('Could not publish report. Please try again.');
      return;
    }
    toast.success('Report published');
    setReportForm({ title: '', body: '' });
    loadMetrics();
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('community_posts').insert({
      title: communityForm.title,
      body: communityForm.body,
      author_id: session?.user.id,
    } as any);
    if (error) {
      toast.error('Could not post announcement. Please try again.');
      return;
    }
    toast.success('Announcement posted');
    setCommunityForm({ title: '', body: '' });
    loadMetrics();
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('teams').insert({
      name: teamForm.name,
      startup_title: teamForm.startup_title,
      startup_pitch: teamForm.startup_pitch,
      cohort_id: cohort?.id || null,
    } as any);
    if (error) {
      toast.error('Could not create team. Please try again.');
      return;
    }
    toast.success('Team created');
    setTeamForm({ name: '', startup_title: '', startup_pitch: '' });
  };

  const loadBugReports = async () => {
    setBugReportsLoading(true);
    const { data } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setBugReports(data as any);
    setBugReportsLoading(false);
  };

  const updateBugReport = async (id: string, patch: any) => {
    const { error } = await supabase.from('bug_reports').update(patch as any).eq('id', id);
    if (error) {
      toast.error('Could not update report.');
    } else {
      toast.success('Report updated');
      loadBugReports();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Checking admin access…</div>
      </main>
    );
  }

  const adminCount = profiles.filter(p => p.role === 'admin').length;
  const memberCount = profiles.filter(p => p.role !== 'admin').length;

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-2">
            <PageHeader
              icon={Settings}
              title="Admin"
              subtitle={role ? `Signed in as ${role}` : undefined}
              action={
                <div className="flex items-center gap-2">
                  <a
                    href="/dashboard"
                    className="h-9 px-3 rounded-lg bg-amber-400/10 border border-amber-500/30 text-amber-300 font-semibold text-xs hover:bg-amber-400/15 inline-flex items-center gap-1.5 transition-colors"
                    title="See the product through a member's eyes"
                  >
                    <Eye className="w-3.5 h-3.5" /> View as member
                  </a>
                  <button
                    onClick={handleSignOut}
                    className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4 text-neutral-500" />
                  </button>
                </div>
              }
            />
          </div>

          {accessMessage && (
            <div className="mb-6 rounded-xl border border-amber-700/40 bg-amber-950/20 p-5">
              <h4 className="text-sm font-bold text-amber-200 mb-1">Admin access unavailable</h4>
              <p className="text-xs text-amber-200/80 leading-relaxed">{accessMessage}</p>
            </div>
          )}

          {role === 'admin' && (
            <>
              {/* Metrics overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <MetricCard icon={Users} label="Members" value={memberCount} />
                <MetricCard icon={Activity} label="Active today" value={activeToday} />
                <MetricCard icon={TrendingUp} label="Avg streak" value={streakAvg !== null ? `${streakAvg}d` : '—'} />
                <MetricCard icon={BookOpen} label="Reports" value={reportCount} />
              </div>

              {/* Cohort progress strip — only when an active cohort exists */}
              {cohortProgress && <CohortProgressCard {...cohortProgress} />}

              {/* Tabs */}
              <div className="flex items-center gap-1 mb-5 border-b border-neutral-900 overflow-x-auto">
                {([
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'setup', label: 'Setup' },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'support', label: 'Support' },
                  { id: 'demo', label: 'Demo seed' },
                ] as { id: Tab; label: string }[]).map(({ id: t, label }) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`shrink-0 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${
                      tab === t ? 'text-amber-300' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {label}
                    {tab === t && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-amber-400" />}
                  </button>
                ))}
              </div>

              {tab === 'daily' && (
                <div className="space-y-6">
                  {/* Cohort */}
                  <SectionCard title="Cohort" icon={TrendingUp}>
                    {loading ? (
                      <div className="text-sm text-neutral-500 animate-pulse">Loading…</div>
                    ) : (
                      <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <Field label="Cohort Name">
                            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60" placeholder="Aug 2026 Cohort" />
                          </Field>
                          <Field label="Start Date">
                            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60" />
                          </Field>
                          <Field label="End Date">
                            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white focus:outline-none focus:border-amber-500/60" />
                          </Field>
                          <Field label="Status">
                            <label className="flex items-center gap-2 h-10 text-sm text-neutral-300 cursor-pointer">
                              <input type="checkbox" checked={form.enrollment_open} onChange={e => setForm({ ...form, enrollment_open: e.target.checked })} className="w-4 h-4 rounded" />
                              Enrollment open
                            </label>
                          </Field>
                        </div>
                        <button type="submit" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs tracking-wide hover:bg-amber-300 transition-colors">
                          <Save className="w-3.5 h-3.5" /> Save Cohort
                        </button>
                      </form>
                    )}
                  </SectionCard>

                  {/* Users */}
                  <SectionCard title="Users & Roles" icon={Users}>
                    {profilesLoading ? (
                      <div className="text-xs text-neutral-500 animate-pulse">Loading profiles…</div>
                    ) : profiles.length === 0 ? (
                      <p className="text-xs text-neutral-500">No members yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-96 overflow-auto pr-1">
                        {profiles.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-neutral-900/50 border border-neutral-800 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                                {p.username}
                                {p.role === 'admin' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">
                                    <Shield className="w-3 h-3" />ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-500 truncate">{p.email}</div>
                            </div>
                            <button
                              onClick={() => handleRoleToggle(p)}
                              className={`ml-3 h-7 px-3 rounded-md text-[10px] font-bold border transition-colors ${
                                p.role === 'admin'
                                  ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500'
                                  : 'bg-amber-400/10 border-amber-900/30 text-amber-300 hover:bg-amber-400/15'
                              }`}
                            >
                              {p.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {adminCount > 0 && (
                      <p className="text-[10px] text-neutral-500 mt-3">
                        {adminCount} admin{adminCount === 1 ? '' : 's'} · {memberCount} member{memberCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </SectionCard>
                </div>
              )}

              {tab === 'weekly' && (
                <div className="space-y-6">
                  {/* Create Report */}
                  <SectionCard title="Publish Report" icon={FileText}>
                    <form onSubmit={handleCreateReport} className="space-y-3">
                      <input type="text" required placeholder="Report title" value={reportForm.title} onChange={e => setReportForm({ ...reportForm, title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60" />
                      <textarea required placeholder="Body" value={reportForm.body} onChange={e => setReportForm({ ...reportForm, body: e.target.value })} className="w-full h-28 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 resize-y" />
                      <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Publish Report
                      </button>
                    </form>
                  </SectionCard>

                  {/* Create Community Post */}
                  <SectionCard title="Post Announcement" icon={MessageCircle}>
                    <form onSubmit={handleCreateCommunity} className="space-y-3">
                      <input type="text" required placeholder="Announcement title" value={communityForm.title} onChange={e => setCommunityForm({ ...communityForm, title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60" />
                      <textarea required placeholder="Body" value={communityForm.body} onChange={e => setCommunityForm({ ...communityForm, body: e.target.value })} className="w-full h-28 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 resize-y" />
                      <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Post Announcement
                      </button>
                    </form>
                  </SectionCard>
                </div>
              )}

              {tab === 'setup' && (
                <div className="space-y-6">
                  <SectionCard title="Create Team" icon={Users}>
                    <form onSubmit={handleCreateTeam} className="space-y-3">
                      <input type="text" required placeholder="Team name" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60" />
                      <input type="text" placeholder="Startup title" value={teamForm.startup_title} onChange={e => setTeamForm({ ...teamForm, startup_title: e.target.value })} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-700 px-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60" />
                      <textarea placeholder="Startup pitch" value={teamForm.startup_pitch} onChange={e => setTeamForm({ ...teamForm, startup_pitch: e.target.value })} className="w-full h-24 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 resize-y" />
                      <button type="submit" className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Create Team
                      </button>
                    </form>
                    <p className="text-[11px] text-neutral-500 mt-3">
                      After creating a team, you can add members from the Members tab. Teams are auto-assigned to the current cohort.
                    </p>
                  </SectionCard>
                </div>
              )}

              {tab === 'analytics' && (
                <div className="space-y-6">
                  <AnalyticsTab />
                </div>
              )}

              {tab === 'support' && (
                <div className="space-y-6">
                  <SectionCard title="Bug Reports" icon={Bug}>
                    {bugReportsLoading ? (
                      <div className="text-xs text-neutral-500 animate-pulse">Loading reports…</div>
                    ) : bugReports.length === 0 ? (
                      <p className="text-xs text-neutral-500 text-center py-4">No reports yet. Inbox zero!</p>
                    ) : (
                      <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
                        {bugReports.map((r: any) => {
                          const status = r.status || 'open';
                          const statusColor = (
                            {
                              open: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
                              triaged: 'bg-violet-500/20 text-violet-200 border-violet-500/30',
                              resolved: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
                              closed: 'bg-neutral-700/30 text-neutral-400 border-neutral-700/30',
                            } as Record<string, string>
                          )[status] || 'bg-neutral-700/30 text-neutral-300 border-neutral-700/30';
                          return (
                            <div key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3.5">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`text-[9px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded border ${statusColor}`}>
                                    {status}
                                  </span>
                                  <span className="text-xs text-neutral-300 font-mono truncate">{r.user_email || 'anonymous'}</span>
                                </div>
                                <span className="text-[10px] text-neutral-600 font-mono shrink-0 inline-flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-200 leading-relaxed mb-2 whitespace-pre-wrap">{r.body}</p>
                              {r.url && (
                                <p className="text-[10px] text-neutral-600 font-mono truncate mb-2">URL: {r.url}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-800">
                                {(['open', 'triaged', 'resolved', 'closed'] as const).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => updateBugReport(r.id, { status: s, ...(s === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })}
                                    disabled={status === s}
                                    className={`h-6 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                      status === s
                                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}

              {tab === 'demo' && (
                <div className="space-y-6">
                  <DemoSeedTab onSeeded={loadMetrics} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        destructive={confirmDialog.destructive}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string | null }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#121212]/50 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-neutral-500" />
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</span>
      </div>
      <p className="text-2xl font-black text-amber-100">{value ?? '—'}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-3.5 h-3.5 text-neutral-500" />
        <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-neutral-300 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function CohortProgressCard({ dayNumber, total, pct, phase, activeRate, healthScore, healthLabel }: {
  dayNumber: number;
  total: number;
  pct: number;
  phase: 'pre' | 'running' | 'done';
  activeRate: number;
  healthScore: number;
  healthLabel: 'thriving' | 'steady' | 'at risk';
}) {
  const phaseCopy =
    phase === 'pre' ? 'Pre-cohort' :
    phase === 'done' ? 'Cohort complete' :
    'In progress';
  const phaseColor =
    phase === 'pre' ? 'text-amber-200' :
    phase === 'done' ? 'text-violet-200' :
    'text-emerald-200';
  const healthColor =
    healthLabel === 'thriving' ? 'text-emerald-300 border-emerald-700/40 bg-emerald-950/30' :
    healthLabel === 'steady' ? 'text-amber-300 border-amber-700/40 bg-amber-950/30' :
    'text-red-300 border-red-700/40 bg-red-950/30';
  const healthEmoji =
    healthLabel === 'thriving' ? '🔥' :
    healthLabel === 'steady' ? '⚖️' :
    '⚠️';

  return (
    <div className="mb-6 rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/30 to-amber-900/5 p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 font-bold">Cohort progress</p>
          <h2 className="text-2xl md:text-3xl font-black text-amber-100 mt-1 leading-tight">
            Day {dayNumber} <span className="text-base text-amber-300/60 font-bold">of {total}</span>
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60 font-bold">Status</p>
          <p className={`text-sm font-extrabold ${phaseColor}`}>{phaseCopy}</p>
        </div>
      </div>
      <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Mini label="Active today" value={`${activeRate}%`} />
        <Mini label="Days remaining" value={String(Math.max(0, total - dayNumber))} />
        <Mini label="Completion" value={`${pct}%`} />
      </div>
      <div className={`rounded-xl border p-3 flex items-center gap-3 ${healthColor}`}>
        <span className="text-xl shrink-0">{healthEmoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">Cohort health</p>
          <p className="text-sm font-extrabold capitalize leading-tight">{healthLabel} · {healthScore}/100</p>
        </div>
        <p className="text-[10px] opacity-70 leading-tight text-right max-w-[120px]">
          {healthLabel === 'thriving' ? 'Momentum is real. Keep doing what you\u2019re doing.' :
           healthLabel === 'steady' ? 'Cohort is holding. Look at the nudge list.' :
           'Activity dipping. Time to reach out.'}
        </p>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 border border-amber-700/20 p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-amber-300/60 font-bold">{label}</p>
      <p className="text-base font-black text-amber-100 mt-0.5">{value}</p>
    </div>
  );
}
