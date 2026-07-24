"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Field from '@/components/Field';
import { email, validateValues, hasErrors } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [emailVal, setEmailVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(undefined);

    const errs = validateValues({ email: emailVal }, { email });
    if (hasErrors(errs)) {
      setFieldError(errs.email);
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailVal, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <div className="w-12 h-12 rounded-full bg-amber-400/10 mx-auto mb-4 flex items-center justify-center">
          <Mail className="w-5 h-5 text-amber-300" />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-center">Check your email.</h2>
        <p className="text-sm text-neutral-400 text-center mb-1">
          We sent a password reset link to <span className="text-amber-200 font-semibold">{emailVal}</span>.
        </p>
        <p className="text-xs text-neutral-500 text-center mb-6">
          The link expires in 1 hour. Check spam if you don&apos;t see it.
        </p>
        <div className="text-center">
          <Link href="/auth/login" className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-4 transition-colors">
        <ArrowLeft className="w-3 h-3" /> Back to sign in
      </Link>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Forgot your password?</h2>
      <p className="text-xs text-neutral-500 mb-6">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="Email" required error={fieldError}>
          {(id, describedBy) => (
            <input
              id={id}
              type="email"
              required
              value={emailVal}
              onChange={(e) => {
                setEmailVal(e.target.value);
                if (fieldError) setFieldError(undefined);
              }}
              autoComplete="email"
              autoFocus
              aria-invalid={!!fieldError}
              aria-describedby={describedBy}
              className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
                fieldError
                  ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
              }`}
              placeholder="you@domain.com"
            />
          )}
        </Field>

        {error && (
          <div role="alert" className="rounded-lg bg-amber-900/15 border border-amber-900/40 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-[11px] text-neutral-500 text-center">
        Remembered it?{' '}
        <Link href="/auth/login" className="text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </>
  );
}
