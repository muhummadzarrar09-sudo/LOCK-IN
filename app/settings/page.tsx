"use client";
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bell, Shield, LogOut, Check, Smartphone, User, Edit2, Save, X, Bug, Trash2, Award, Snowflake, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import { DEFAULT_PREFS, loadPrefs, requestPermission, savePrefs, syncPrefsToServer, syncPrefsFromServer, type ReminderPrefs } from '@/lib/reminders';
import { username as usernameRule, validateValues, hasErrors } from '@/lib/validation';
import { AchievementGrid } from '@/components/AchievementBadge';
import { ACHIEVEMENTS, AchievementCode } from '@/lib/achievements';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center"><div className="text-neutral-500 text-sm animate-pulse">Loading…</div></div>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<{ username: string; timezone: string } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', timezone: '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string | undefined>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [sendingReport, setSendingReport] = useState(false);

  // Achievements + streak freezes (used in the badges section)
  const [earnedCodes, setEarnedCodes] = useState<AchievementCode[]>([]);
  const [unusedFreezes, setUnusedFreezes] = useState(0);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('report') === '1') {
      setReportOpen(true);
      // Auto-focus the textarea after a tick
      setTimeout(() => {
        document.getElementById('report-textarea')?.focus();
      }, 100);
    }
  }, [searchParams]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/settings');
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      if (session.user.email) setUserEmail(session.user.email);

      // Load profile
      const { data: prof } = await supabase.from('profiles').select('username, timezone').eq('id', uid).maybeSingle();
      if (prof) {
        const tz = (prof as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        setProfile({ username: (prof as any).username || '', timezone: tz });
        setProfileForm({ username: (prof as any).username || '', timezone: tz });
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setProfile({ username: '', timezone: tz });
        setProfileForm({ username: '', timezone: tz });
      }

      // Load prefs: server first, fall back to localStorage
      const serverPrefs = await syncPrefsFromServer();
      const localLoaded = loadPrefs();
      const merged: ReminderPrefs = { ...localLoaded, ...serverPrefs, permission: typeof Notification !== 'undefined' ? Notification.permission : 'default' };
      setPrefs(merged);
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);

      // Load achievements + unused freezes (best-effort, non-blocking)
      const [{ data: achData }, { count: freezeCount }] = await Promise.all([
        supabase.from('achievements').select('code').eq('user_id', uid).order('earned_at', { ascending: false }),
        supabase.from('streak_freezes').select('*', { count: 'exact', head: true }).eq('user_id', uid).is('used_at', null),
      ]);
      setEarnedCodes(((achData || []) as any[]).map((a) => a.code as AchievementCode));
      setUnusedFreezes(freezeCount || 0);

      setLoading(false);
    };
    init();
  }, [router]);

  const updatePref = (patch: Partial<ReminderPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    // Best-effort server sync, fire-and-forget
    syncPrefsToServer(next);
  };

  const handleEnableReminders = async () => {
    const result = await requestPermission();
    setPermission(result);
    if (result === 'granted') {
      updatePref({ enabled: true });
      toast.success('Reminders enabled');
    } else if (result === 'denied') {
      toast.error('Reminders blocked. Enable in your browser settings.');
    } else {
      toast.info('Reminder permission dismissed');
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setProfileErrors({});
    const errs = validateValues(profileForm, { username: usernameRule });
    if (hasErrors(errs)) { setProfileErrors(errs); return; }

    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        username: profileForm.username,
        timezone: profileForm.timezone,
        email: userEmail,
      } as any, { onConflict: 'id' });
      if (error) {
        toast.error('Could not save profile. Please try again.');
      } else {
        setProfile({ username: profileForm.username, timezone: profileForm.timezone });
        setEditingProfile(false);
        toast.success('Profile updated');
      }
    } catch {
      toast.error('Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const handleSendReport = async () => {
    if (!reportText.trim()) {
      toast.error('Tell us what happened before sending.');
      return;
    }
    setSendingReport(true);
    try {
      const { error } = await supabase.from('bug_reports').insert({
        user_id: userId,
        user_email: userEmail,
        body: reportText.trim(),
        url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      } as any);
      if (error) throw error;
      toast.success('Report sent. Thank you.');
      setReportOpen(false);
      setReportText('');
    } catch (err: any) {
      console.warn('bug report submit failed:', err);
      toast.error('Could not send. Please email support@accountability.com directly.');
    } finally {
      setSendingReport(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Loading…</div>
      </main>
    );
  }

  const toggleOptions: { key: keyof ReminderPrefs; label: string; desc: string }[] = [
    { key: 'checkIn', label: 'Time-block reminders', desc: 'Notify me before each block starts.' },
    { key: 'dailyStart', label: 'Daily start', desc: 'Notify me at the start of the cohort day.' },
    { key: 'newReport', label: 'New reports', desc: 'Notify me when admin publishes a report.' },
    { key: 'teamUpdate', label: 'Team updates', desc: 'Notify me when my team posts an update.' },
  ];

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-2xl mx-auto">
          <PageHeader
            icon={Shield}
            title="Settings"
            subtitle={userEmail || 'Account & preferences'}
            action={
              <button
                onClick={handleSignOut}
                className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4 text-neutral-500" />
              </button>
            }
          />

          {/* Profile section */}
          <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-500" />
                <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Profile</h2>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-xs text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1.5"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>

            {editingProfile ? (
              <div className="space-y-4">
                <Field label="Username" required error={profileErrors.username} hint="3–24 characters, letters/numbers/underscore only">
                  {(id, describedBy) => (
                    <input
                      id={id}
                      value={profileForm.username}
                      onChange={(e) => {
                        setProfileForm((p) => ({ ...p, username: e.target.value }));
                        if (profileErrors.username) setProfileErrors((p) => ({ ...p, username: undefined }));
                      }}
                      aria-invalid={!!profileErrors.username}
                      aria-describedby={describedBy}
                      className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white focus:outline-none focus:ring-1 transition-all ${
                        profileErrors.username
                          ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                          : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
                      }`}
                    />
                  )}
                </Field>

                <Field label="Timezone" hint="Used for time-block scheduling and reminders">
                  {(id) => (
                    <input
                      id={id}
                      value={profileForm.timezone}
                      onChange={(e) => setProfileForm((p) => ({ ...p, timezone: e.target.value }))}
                      className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white font-mono focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                  )}
                </Field>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="h-10 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileErrors({});
                      if (profile) setProfileForm({ username: profile.username, timezone: profile.timezone });
                    }}
                    className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Row label="Username" value={profile?.username || '—'} mono />
                <Row label="Timezone" value={profile?.timezone || '—'} mono />
              </div>
            )}
          </section>

          {/* Achievements section */}
          <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-neutral-500" />
                <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Achievements</h2>
              </div>
              <span className="text-[10px] text-neutral-500 font-mono">
                {earnedCodes.length} / {Object.keys(ACHIEVEMENTS).length}
              </span>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4">
              Badges earned by hitting streak milestones. Hover any badge to see what it took. They&apos;re public on your profile.
            </p>
            {unusedFreezes > 0 && (
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/30 border border-sky-700/30 text-sky-200 text-xs font-bold">
                <Snowflake className="w-3.5 h-3.5 text-sky-300" />
                {unusedFreezes} streak freeze{unusedFreezes === 1 ? '' : 's'} ready (auto-applied on missed days)
              </div>
            )}
            <AchievementGrid
              codes={earnedCodes}
              size="md"
              emptyMessage="No badges yet. Your first unlock happens at a 3-day streak."
            />
            <div className="mt-4 pt-4 border-t border-neutral-900">
              <Link
                href={`/u/${profile?.username || ''}`}
                className="text-[10px] text-amber-300 hover:text-amber-200 font-bold uppercase tracking-wider"
              >
                View your public profile →
              </Link>
            </div>
          </section>

          {/* Reminders section */}
          <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-neutral-500" />
              <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Reminders</h2>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed mb-5">
              Get notified when time blocks start, when your team ships something, or when new reports drop. We use your browser&apos;s built-in notifications — no email, no separate app.
            </p>

            {permission !== 'granted' ? (
              <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4 mb-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4 text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-amber-100 mb-1">Enable browser notifications</h3>
                  <p className="text-xs text-amber-200/80 mb-3">
                    {permission === 'denied'
                      ? 'You\'ve blocked notifications. Update your browser settings to allow them for this site.'
                      : 'Click below to allow Discipline to send you reminders.'}
                  </p>
                  <button
                    onClick={handleEnableReminders}
                    disabled={permission === 'denied'}
                    className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {permission === 'denied' ? 'Blocked in browser' : 'Enable reminders'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/15 p-3 mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-emerald-200 font-semibold">Browser notifications enabled</span>
              </div>
            )}

            <div className="space-y-1">
              {toggleOptions.map((opt) => {
                const enabled = prefs[opt.key] as boolean;
                return (
                  <button
                    key={opt.key}
                    onClick={() => updatePref({ [opt.key]: !enabled } as any)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg hover:bg-neutral-900/50 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{opt.label}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                        enabled && prefs.enabled && permission === 'granted' ? 'bg-amber-400' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          enabled && prefs.enabled && permission === 'granted' ? 'translate-x-[18px]' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-5 border-t border-neutral-800">
              <label className="block text-xs font-extrabold text-neutral-400 mb-2 uppercase tracking-wider">
                Notify me before each block
              </label>
              <div className="flex items-center gap-2">
                {[0, 5, 10, 15].map((m) => (
                  <button
                    key={m}
                    onClick={() => updatePref({ minutesBefore: m })}
                    className={`h-9 px-4 rounded-lg text-xs font-bold transition-colors ${
                      prefs.minutesBefore === m
                        ? 'bg-amber-400 text-black'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    {m === 0 ? 'On time' : `${m} min`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Account info section */}
          <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-4">Account</h2>
            <div className="space-y-3">
              <Row label="Email" value={userEmail || '—'} mono />
              <Row label="Password" value="••••••••" mono />
              <a
                href="/auth/forgot"
                className="inline-block text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4"
              >
                Change password
              </a>
            </div>
          </section>

          {/* Support section */}
          <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bug className="w-4 h-4 text-neutral-500" />
              <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Support</h2>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed mb-5">
              Found something broken or confusing? Tell us. We read every report.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setReportOpen(true);
                  setTimeout(() => document.getElementById('report-textarea')?.focus(), 100);
                }}
                className="h-10 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 inline-flex items-center gap-2 transition-colors"
              >
                <Bug className="w-3.5 h-3.5" /> Report a problem
              </button>
              <a
                href="/help"
                className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
              >
                Help & FAQ
              </a>
              <a
                href="/whats-new"
                className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> What’s new
              </a>
              <button
                onClick={() => {
                  // Reset onboarding + welcome state, then redirect to welcome
                  try {
                    localStorage.removeItem('discipline.onboardingHints.dismissed.v1');
                  } catch { /* ignore */ }
                  toast.success('Tour reset. Replaying welcome.');
                  setTimeout(() => router.push('/welcome'), 600);
                }}
                className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Replay welcome
              </button>
              <a
                href="mailto:support@accountability.com"
                className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4 ml-auto self-center"
              >
                support@accountability.com
              </a>
            </div>
          </section>

          {/* Danger zone */}
          <section className="mb-6 rounded-2xl border border-red-900/40 bg-red-950/10 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-red-300" />
              <h2 className="text-xs font-extrabold text-red-300 uppercase tracking-[0.2em]">Danger zone</h2>
            </div>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4">
              Permanently delete your account, profile, check-ins, streaks, and team feed posts. This cannot be undone.
            </p>
            <Link
              href="/settings/delete"
              className="inline-flex h-9 px-4 rounded-lg border border-red-800/50 bg-red-950/30 text-red-200 font-semibold text-xs hover:bg-red-900/40 hover:border-red-700 transition-colors"
            >
              Delete my account
            </Link>
          </section>
        </div>
      </main>

      {/* Report a problem modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-5"
          onClick={() => setReportOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <div
            className="max-w-md w-full rounded-2xl border border-neutral-800 bg-[#121212] p-6 shadow-2xl fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-1">Support</p>
                <h2 id="report-title" className="text-base font-extrabold tracking-tight text-white">Report a problem</h2>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed mb-3">
              Tell us what happened. We&apos;ll include your account info automatically so we can help faster.
            </p>
            <textarea
              id="report-textarea"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="e.g. The dashboard shows 'no blocks' even though I have 6 set up…"
              rows={5}
              className="w-full rounded-lg bg-neutral-900/60 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 resize-y transition-all"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setReportOpen(false)}
                className="h-9 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:border-neutral-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReport}
                disabled={sendingReport || !reportText.trim()}
                className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
              >
                {sendingReport ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span className={`text-neutral-200 text-xs truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
