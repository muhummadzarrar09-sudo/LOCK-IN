"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Check, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import { minLength, validateValues, hasErrors } from '@/lib/validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    // Supabase auth callback from email link sets a session. Verify it exists.
    const verify = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionValid(true);
      } else {
        setFormError('This reset link is invalid or has expired. Request a new one.');
      }
      setVerifying(false);
    };
    verify();
  }, []);

  const passwordMismatch = values.confirm.length > 0 && values.password !== values.confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errs = validateValues(values, { password: minLength(8) });
    if (values.password !== values.confirm) errs.confirm = 'Passwords do not match';
    if (hasErrors(errs)) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
      if (updateError) {
        setFormError(updateError.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      toast.success('Password updated. Welcome back.');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setFormError(err?.message || 'Unexpected error');
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <>
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-700/30 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-300" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-center">Password updated.</h2>
        <p className="text-sm text-neutral-400 text-center mb-6">Taking you to the cohort…</p>
      </>
    );
  }

  if (!sessionValid) {
    return (
      <>
        <div className="w-12 h-12 rounded-full bg-amber-500/10 mx-auto mb-4 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-300" />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-center">Reset link expired</h2>
        <p className="text-sm text-neutral-400 text-center mb-1">{formError}</p>
        <p className="text-xs text-neutral-500 text-center mb-6">
          For your security, reset links expire after 1 hour.
        </p>
        <div className="text-center">
          <Link href="/auth/forgot" className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
            Request a new link
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Set a new password</h2>
      <p className="text-xs text-neutral-500 mb-6">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="New password" required error={fieldErrors.password} hint="8+ characters">
          {(id, describedBy) => (
            <input
              id={id}
              type="password"
              required
              value={values.password}
              onChange={(e) => {
                setValues((p) => ({ ...p, password: e.target.value }));
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              autoComplete="new-password"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={describedBy}
              className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
                fieldErrors.password
                  ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
              }`}
              placeholder="Minimum 8 characters"
            />
          )}
        </Field>

        <div>
          <label htmlFor="reset-confirm" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
            Confirm new password <span className="text-amber-400">*</span>
          </label>
          <input
            id="reset-confirm"
            type="password"
            required
            value={values.confirm}
            onChange={(e) => {
              setValues((p) => ({ ...p, confirm: e.target.value }));
              if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }));
            }}
            autoComplete="new-password"
            className={`w-full h-11 rounded-lg bg-neutral-900/60 border px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 transition-all ${
              fieldErrors.confirm
                ? 'border-red-700/60 focus:border-red-500/60 focus:ring-red-500/20'
                : 'border-neutral-700 focus:border-amber-500/60 focus:ring-amber-500/20'
            }`}
            placeholder="Re-enter your new password"
          />
          {fieldErrors.confirm && (
            <p role="alert" className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {fieldErrors.confirm}
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
          disabled={loading || passwordMismatch}
          className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </>
  );
}
