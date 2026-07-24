"use client";
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Field from '@/components/Field';
import { email, required, validateValues, hasErrors } from '@/lib/validation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (k: 'email' | 'password', v: string) => {
    setValues((p) => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation
    const errs = validateValues(values, {
      email,
      password: required,
    });
    if (hasErrors(errs)) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setFormError('Invalid email or password. Please try again.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setFormError('Please verify your email before signing in. Check your inbox.');
        } else {
          setFormError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setFormError('Sign in failed. Please try again.');
        setLoading(false);
        return;
      }

      let role: string | null = null;
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            const username = data.user.email?.split('@')[0] || 'member';
            await supabase.from('profiles').upsert(
              { id: data.user.id, username, email: data.user.email || values.email, role: 'member' },
              { onConflict: 'id' }
            );
          }
        } else {
          role = (profile as any)?.role ?? null;
        }
      } catch (profErr) {
        console.warn('Profile fetch threw:', profErr);
      }

      let finalTarget = redirectTo;
      const isExplicitRedirect = searchParams.has('redirect');
      if (!isExplicitRedirect) {
        finalTarget = role === 'admin' ? '/admin' : '/dashboard';
      }

      if (typeof window !== 'undefined') {
        window.location.href = finalTarget;
      } else {
        router.push(finalTarget);
        router.refresh();
      }
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error');
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Sign In</h2>
      <p className="text-xs text-neutral-500 mb-6">Welcome back. We&apos;ll keep you signed in for 30 days.</p>

      <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
              Password <span className="text-amber-400">*</span>
            </label>
            <Link
              href="/auth/forgot"
              className="text-[11px] text-neutral-500 hover:text-amber-300 transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            value={values.password}
            onChange={(e) => update('password', e.target.value)}
            autoComplete="current-password"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.password
                ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
            }`}
            placeholder="Your secure password"
          />
          {fieldErrors.password && (
            <p id="login-password-error" role="alert" className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {fieldErrors.password}
            </p>
          )}
        </div>

        {formError && (
          <div role="alert" className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
        <p className="text-xs text-neutral-500 mb-2">
          New to the cohort?{' '}
          <Link href="/auth/signup" className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
            Create an account
          </Link>
        </p>
        <p className="text-[11px] text-neutral-600">
          Trouble signing in?{' '}
          <a href="mailto:support@accountability.com" className="text-neutral-500 hover:text-amber-300 underline underline-offset-4">
            Contact support
          </a>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-neutral-500 animate-pulse">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
