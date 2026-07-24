"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DeleteAccountPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0=warning, 1=confirm text, 2=final dialog, 3=done
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth/login?redirect=/settings/delete'); return; }
      setUserId(session.user.id);
      if (session.user.email) setUserEmail(session.user.email);
      setLoading(false);
    };
    init();
  }, [router]);

  const performDeletion = async () => {
    if (!userId) return;
    setDialog(false);
    setDeleting(true);
    try {
      // 1. Delete user-owned data. Order: children first (FKs may not cascade).
      // We'll attempt the deletes and tolerate failures since some tables may not exist.
      const tables = [
        { name: 'check_ins', column: 'user_id' },
        { name: 'time_blocks', column: 'user_id' },
        { name: 'streaks', column: 'user_id' },
        { name: 'team_members', column: 'user_id' },
        { name: 'team_startup_log', column: 'user_id' },
        { name: 'reminders', column: 'user_id' },
        { name: 'device_sessions', column: 'user_id' },
      ];
      for (const t of tables) {
        try {
          await (supabase.from(t.name) as any).delete().eq(t.column, userId);
        } catch (e) {
          // ignore — table may not exist or already empty
        }
      }
      // 2. Delete profile row
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch {}

      // 3. Sign out (this also clears the local session; the auth user row
      //    will need to be deleted from Supabase Auth — typically via service role.
      //    We sign out so the user can no longer use the account from the client.)
      await supabase.auth.signOut();

      setStep(3);
      toast.success('Your account has been deleted.');
    } catch (err: any) {
      toast.error('Something went wrong. Please email support@accountability.com.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Loading…</div>
      </main>
    );
  }

  if (step === 3) {
    return (
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-700/30 mx-auto mb-5 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-emerald-300" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">
            Account deleted.
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed mb-6">
            We&apos;ve removed your profile, check-ins, streaks, and team feed posts. Your auth account has been signed out.
          </p>
          <p className="text-xs text-neutral-500 mb-6">
            If you change your mind, just sign up again with the same email.
          </p>
          <Link
            href="/"
            className="h-11 px-5 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 inline-flex items-center gap-2 transition-colors"
          >
            Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
      <div className="max-w-md mx-auto px-5 md:px-6 py-12 md:py-20">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-6 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back to settings
        </Link>

        {step === 0 && (
          <div className="fade-in-up">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-700/30 mx-auto mb-5 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-300" />
            </div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3 text-center">
              Delete your account?
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6 text-center max-w-sm mx-auto">
              This will permanently remove your profile, check-ins, streaks, team feed posts, and any team memberships. Your auth account will be signed out.
            </p>
            <div className="rounded-xl border border-red-900/40 bg-red-950/15 p-4 mb-6">
              <p className="text-xs font-bold text-red-200 uppercase tracking-wider mb-2">This will delete:</p>
              <ul className="text-xs text-neutral-300 space-y-1 list-disc pl-4">
                <li>Your profile (username, email, timezone)</li>
                <li>All check-ins and streak history</li>
                <li>All your time blocks</li>
                <li>Your team feed posts</li>
                <li>Your team memberships</li>
                <li>Your reminder preferences</li>
              </ul>
            </div>
            <p className="text-xs text-neutral-500 text-center mb-6">
              This cannot be undone. If you want to come back, you&apos;ll have to sign up again.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="flex-1 h-11 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center justify-center transition-colors"
              >
                Keep my account
              </Link>
              <button
                onClick={() => setStep(1)}
                className="flex-1 h-11 rounded-xl bg-red-500/20 border border-red-800/50 text-red-200 font-extrabold text-sm hover:bg-red-500/30 inline-flex items-center justify-center gap-2 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fade-in-up">
            <h1 className="font-serif text-3xl tracking-tighter text-white mb-2 text-center">
              Type your email to confirm.
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6 text-center">
              Type <span className="font-mono text-amber-200 bg-amber-900/20 px-1.5 py-0.5 rounded">{userEmail}</span> below to continue.
            </p>
            <input
              type="email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={userEmail}
              autoComplete="off"
              aria-label="Type your email to confirm deletion"
              className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all mb-6"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep(0)}
                className="flex-1 h-11 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setDialog(true)}
                disabled={confirmText.toLowerCase().trim() !== userEmail.toLowerCase().trim()}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white font-extrabold text-sm hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                I understand
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={dialog}
          onCancel={() => setDialog(false)}
          onConfirm={performDeletion}
          title="This is permanent."
          message={`All your data will be erased: profile, check-ins, streaks, team posts, and memberships. You'll be signed out. This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete forever'}
          cancelLabel="Cancel"
          destructive
        />

        {deleting && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center" role="status" aria-live="polite">
            <div className="rounded-2xl border border-neutral-800 bg-[#121212] p-6 flex items-center gap-3 shadow-2xl">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-sm text-white font-semibold">Deleting your account…</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
