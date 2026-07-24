"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Field from '@/components/Field';
import { compose, email, minLength, username as usernameRule, validateValues, hasErrors } from '@/lib/validation';

function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!p) return { score: 0, label: '', color: 'bg-neutral-800' };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label: 'Too short', color: 'bg-red-700' },
    { label: 'Weak', color: 'bg-red-500' },
    { label: 'Okay', color: 'bg-amber-500' },
    { label: 'Good', color: 'bg-emerald-500' },
    { label: 'Strong', color: 'bg-emerald-400' },
  ] as const;
  return { score: s as 0 | 1 | 2 | 3 | 4, label: map[s as 0 | 1 | 2 | 3 | 4].label, color: map[s as 0 | 1 | 2 | 3 | 4].color };
}

export default function SignupPage() {
  const router = useRouter();
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    } catch { /* ignore */ }
  }, []);

  const strength = useMemo(() => passwordStrength(values.password), [values.password]);
  const passwordMismatch = values.confirm.length > 0 && values.password !== values.confirm;

  const update = (k: 'username' | 'email' | 'password' | 'confirm', v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errs = validateValues(values, {
      username: usernameRule,
      email,
      password: compose(minLength(8)),
    });
    if (values.password !== values.confirm) {
      errs.confirm = 'Passwords do not match';
    }
    if (hasErrors(errs)) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { username: values.username, timezone },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered') || authError.message.toLowerCase().includes('user already')) {
          setFormError('An account with this email already exists. Try signing in instead.');
        } else {
          setFormError(authError.message);
        }
        setLoading(false);
        return;
      }

      // If session is null but user exists, email verification is required
      if (data.user && !data.session) {
        setNeedsEmailVerification(true);
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Session exists — create profile
      if (data.user && data.session) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id, username: values.username, email: values.email, role: 'member',
        } as any);
        if (profileError) {
          await supabase.from('profiles').upsert(
            { id: data.user.id, username: values.username, email: values.email, role: 'member' } as any,
            { onConflict: 'id' }
          );
        }
      }

      setSuccess(true);
      setLoading(false);
      // Route to onboarding if no email verification, or to welcome screen
      setTimeout(() => router.push(data.session ? '/welcome' : '/auth/login'), 1500);
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error');
      setLoading(false);
    }
  };

  if (success && needsEmailVerification) {
    return (
      <>
        <div className="w-12 h-12 rounded-full bg-amber-400/10 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-5 h-5 text-amber-300" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-center">Check your email.</h2>
        <p className="text-sm text-neutral-400 text-center mb-1">
          We sent a verification link to <span className="text-amber-200 font-semibold">{values.email}</span>.
        </p>
        <p className="text-xs text-neutral-500 text-center mb-6">
          Click the link to confirm your account, then sign in.
        </p>
        <div className="text-center">
          <Link href="/auth/login" className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <div className="w-12 h-12 rounded-full bg-amber-400/10 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-5 h-5 text-amber-300" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-center">You&apos;re in.</h2>
        <p className="text-sm text-neutral-400 text-center mb-6">Account created. Setting up your cohort…</p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Join the Cohort</h2>
      <p className="text-xs text-neutral-500 mb-6">30-day execution cohort · Members only · No refunds</p>

      <form onSubmit={handleSignup} className="space-y-5" noValidate>
        <Field label="Username" required error={fieldErrors.username}>
          {(id, describedBy) => (
            <input
              id={id}
              required
              minLength={3}
              value={values.username}
              onChange={(e) => update('username', e.target.value)}
              autoComplete="username"
              aria-invalid={!!fieldErrors.username}
              aria-describedby={describedBy}
              className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
                fieldErrors.username
                  ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
              }`}
              placeholder="your_username"
            />
          )}
        </Field>

        <Field label="Email" required error={fieldErrors.email}>
          {(id, describedBy) => (
            <input
              id={id}
              type="email"
              required
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={describedBy}
              className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
                fieldErrors.email
                  ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
              }`}
              placeholder="you@domain.com"
            />
          )}
        </Field>

        <div>
          <label htmlFor="signup-password" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
            Password <span className="text-amber-400">*</span>
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={values.password}
            onChange={(e) => update('password', e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'signup-password-error' : 'signup-password-hint'}
            className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.password
                ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
            }`}
            placeholder="Minimum 8 characters"
          />
          {values.password && !fieldErrors.password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-colors ${
                      i < strength.score ? strength.color : 'bg-neutral-800'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 w-12 text-right">
                {strength.label}
              </span>
            </div>
          )}
          {fieldErrors.password ? (
            <p id="signup-password-error" role="alert" className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {fieldErrors.password}
            </p>
          ) : (
            <p id="signup-password-hint" className="text-[11px] text-neutral-500 mt-1.5">
              8+ characters. Mix of letters, numbers, and symbols is stronger.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="signup-confirm" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
            Confirm password <span className="text-amber-400">*</span>
          </label>
          <input
            id="signup-confirm"
            type="password"
            required
            value={values.confirm}
            onChange={(e) => update('confirm', e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!fieldErrors.confirm}
            aria-describedby={fieldErrors.confirm ? 'signup-confirm-error' : undefined}
            className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.confirm
                ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
            }`}
            placeholder="Re-enter your password"
          />
          {fieldErrors.confirm && (
            <p id="signup-confirm-error" role="alert" className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {fieldErrors.confirm}
            </p>
          )}
        </div>

        {timezone && (
          <div className="rounded-lg bg-neutral-900/40 border border-neutral-800 px-3 py-2 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Detected timezone</span>
            <span className="text-neutral-300 font-mono">{timezone}</span>
          </div>
        )}

        {formError && (
          <div role="alert" className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || passwordMismatch}
          className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Creating…' : 'Enroll Now'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
        <p className="text-xs text-neutral-500">
          Already a member?{' '}
          <Link href="/auth/login" className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}
