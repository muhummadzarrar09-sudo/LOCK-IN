"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, User, Clock, Sparkles, Loader2, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import Field from '@/components/Field';
import { username as usernameRule, validateValues, hasErrors } from '@/lib/validation';

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { icon: Sparkles, label: 'Welcome' },
  { icon: User, label: 'Profile' },
  { icon: Clock, label: 'Timezone' },
  { icon: Compass, label: 'Day 1' },
];

export default function WelcomePage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [form, setForm] = useState({ username: '', timezone: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth/login'); return; }
      setUserId(session.user.id);
      if (session.user.email) setUserEmail(session.user.email);

      // Detect timezone
      let tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
      setForm((p) => ({ ...p, timezone: tz }));

      // Prefill username from existing profile / auth metadata
      const { data: prof } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle();
      const metaUser = (session.user.user_metadata as any)?.username;
      setForm((p) => ({ ...p, username: (prof as any)?.username || metaUser || (session.user.email || '').split('@')[0] || '' }));
      setLoading(false);
    };
    init();
  }, [router]);

  const advance = async () => {
    if (step === 1) {
      // Validate username
      const errs = validateValues(form, { username: usernameRule });
      if (hasErrors(errs)) { setErrors(errs); return; }
      setErrors({});
    }
    if (step === 2) {
      // Save profile
      if (!userId) return;
      setSaving(true);
      try {
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          username: form.username,
          timezone: form.timezone,
          email: userEmail,
          role: 'member',
        } as any, { onConflict: 'id' });
        if (error) {
          toast.error('Could not save profile. Please try again.');
          setSaving(false);
          return;
        }
        toast.success('Profile saved');
      } catch {
        toast.error('Could not save profile.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    if (step < 3) {
      setStep((s) => (s + 1) as Step);
    } else {
      router.push('/dashboard');
    }
  };

  const back = () => { if (step > 0) setStep((s) => (s - 1) as Step); };

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '120ms' }} />
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '240ms' }} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const current = i === step;
            return (
              <div key={s.label} className="flex-1 flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    done ? 'bg-amber-400 text-black' : current ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-300' : 'bg-neutral-900 border border-neutral-800 text-neutral-600'
                  }`}>
                    {done ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-wider ${current ? 'text-amber-300' : 'text-neutral-600'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-5 ${done ? 'bg-amber-400' : 'bg-neutral-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-[#121212]/80 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-black/50 min-h-[360px] flex flex-col">
          {step === 0 && <Step0 email={userEmail} />}
          {step === 1 && (
            <Step1 form={form} setForm={setForm} errors={errors} setErrors={setErrors} />
          )}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && <Step3 username={form.username} />}

          {/* Actions */}
          <div className="mt-auto pt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                onClick={back}
                className="h-11 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <span />}

            <button
              onClick={advance}
              disabled={saving}
              className="h-11 px-5 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 3 ? 'Enter the cohort' : step === 0 ? "Let's go" : 'Continue'}
              {!saving && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Skip link */}
        {step > 0 && step < 3 && (
          <div className="text-center mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Step0({ email }: { email: string }) {
  return (
    <div className="fade-in-up">
      <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3">Step 1 of 4</p>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">
        Welcome{email ? `, ${email.split('@')[0]}` : ''}.
      </h1>
      <p className="text-sm text-neutral-400 leading-relaxed mb-4">
        You&apos;re in the cohort. Here&apos;s how the next 30 days work:
      </p>
      <ul className="space-y-3 text-sm text-neutral-300">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">1</span>
          <span><span className="font-semibold text-white">Set your profile</span> — username, timezone.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">2</span>
          <span><span className="font-semibold text-white">Day 1 starts</span> — your schedule appears, your first block unlocks at 06:00 local time.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">3</span>
          <span><span className="font-semibold text-white">Check in, ship, repeat.</span> Your team sees everything. Your streak compounds.</span>
        </li>
      </ul>
    </div>
  );
}

function Step1({ form, setForm, errors, setErrors }: { form: any; setForm: any; errors: any; setErrors: any }) {
  return (
    <div className="fade-in-up">
      <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3">Step 2 of 4</p>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-2">What should we call you?</h1>
      <p className="text-sm text-neutral-400 mb-6">Your team and the leaderboard will see this name.</p>
      <Field label="Username" required error={errors.username} hint="3–24 characters, letters/numbers/underscore only">
        {(id, describedBy) => (
          <input
            id={id}
            autoFocus
            value={form.username}
            onChange={(e) => {
              setForm((p: any) => ({ ...p, username: e.target.value }));
              if (errors.username) setErrors((p: any) => ({ ...p, username: undefined }));
            }}
            aria-invalid={!!errors.username}
            aria-describedby={describedBy}
            className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white focus:outline-none focus:ring-1 transition-all ${
              errors.username
                ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
            }`}
            placeholder="your_username"
          />
        )}
      </Field>
    </div>
  );
}

function Step2({ form, setForm }: { form: any; setForm: any }) {
  return (
    <div className="fade-in-up">
      <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3">Step 3 of 4</p>
      <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-2">Confirm your timezone.</h1>
      <p className="text-sm text-neutral-400 mb-6">Time blocks unlock at 06:00 local time. We auto-detect, but you can change it.</p>
      <Field label="Timezone" hint="Used for scheduling and reminders">
        {(id) => (
          <input
            id={id}
            value={form.timezone}
            onChange={(e) => setForm((p: any) => ({ ...p, timezone: e.target.value }))}
            className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white font-mono focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
          />
        )}
      </Field>
    </div>
  );
}

function Step3({ username }: { username: string }) {
  return (
    <div className="fade-in-up">
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-7 h-7 text-amber-300" strokeWidth={2.5} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2">Step 4 of 4</p>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-2">
          You&apos;re ready, {username || 'friend'}.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-sm mx-auto">
          Your team will be assigned before Day 1. Here&apos;s what your first day looks like:
        </p>
      </div>

      {/* Mini Day 1 schedule preview */}
      <div className="rounded-xl border border-neutral-800 bg-[#0D0D0D]/60 p-4 mt-2">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-3.5 h-3.5 text-amber-300" />
          <h3 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Day 1 preview</h3>
        </div>
        <ul className="space-y-1.5">
          {[
            { t: '06:00 – 09:00', label: 'Deep work block 1', type: 'work' },
            { t: '09:00 – 09:30', label: 'Protected break', type: 'break' },
            { t: '09:30 – 12:00', label: 'Deep work block 2', type: 'work' },
            { t: '12:00 – 12:30', label: 'Movement', type: 'movement' },
            { t: '12:30 – 13:00', label: 'Reflection / journal', type: 'reflection' },
            { t: '13:00 – 16:00', label: 'Deep work block 3', type: 'work' },
          ].map((b) => {
            const dotColor =
              b.type === 'work' ? 'bg-amber-300' :
              b.type === 'break' ? 'bg-sky-300' :
              b.type === 'movement' ? 'bg-emerald-300' :
              'bg-violet-300';
            return (
              <li key={b.t} className="flex items-center gap-2.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                <span className="font-mono text-neutral-500 text-[10px] w-[88px] shrink-0">{b.t}</span>
                <span className="text-neutral-200 truncate">{b.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-neutral-500 mt-3 leading-relaxed pt-2 border-t border-neutral-900">
          Tap any block on the dashboard to check in. Six blocks per day, every day for 30 days.
        </p>
      </div>
    </div>
  );
}
