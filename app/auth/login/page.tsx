"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid credentials. If you just bought access, check your email or contact support.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Check device session limit (2 max)
      const userId = data.user?.id;
      if (userId) {
        const fingerprint = `${navigator.userAgent}-${window.screen.width}x${window.screen.height}`;
        const { data: existing } = await supabase
          .from('device_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('fingerprint', fingerprint);

        if (!existing || existing.length === 0) {
          const { data: sessions } = await supabase
            .from('device_sessions')
            .select('*')
            .eq('user_id', userId);

          if (sessions && sessions.length >= 2) {
            // Block 3rd login — prompt to replace (simplified for MVP: show message)
            setError('Device limit reached (max 2). Contact support to manage devices.');
            setLoading(false);
            return;
          }

          await supabase.from('device_sessions').insert({
            user_id: userId,
            fingerprint,
            device_type: window.innerWidth < 768 ? 'mobile' : 'laptop',
          });
        } else {
          // Update last active
          await supabase
            .from('device_sessions')
            .update({ last_active: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('fingerprint', fingerprint);
        }
      }

      // Redirect fix: always redirect to intended page after successful auth
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-6 tracking-tight">Sign In</h2>
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
            placeholder="you@domain.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
            placeholder="Your secure password"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-900/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Accessing...' : 'Access Account'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-neutral-800 text-center">
        <p className="text-xs text-neutral-500 mb-1">Bought access but can't sign in?</p>
        <a href="mailto:support@accountability.com" className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-4">
          Contact Support
        </a>
        <span className="text-neutral-600 mx-2">|</span>
        <span className="text-xs text-neutral-500">Phone available after purchase confirmation.</span>
      </div>
    </>
  );
}
