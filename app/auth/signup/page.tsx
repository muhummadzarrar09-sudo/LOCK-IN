"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Create profile immediately
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username,
          email,
          role: 'member',
        });
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => router.push('/auth/login'), 1500);
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Create Account</h2>
      <p className="text-xs text-neutral-500 mb-6">Enrollment closes when the cohort is full. Confirmed members only.</p>

      {success ? (
        <div className="rounded-xl bg-amber-900/20 border border-amber-900/30 p-6 text-center">
          <h3 className="text-amber-400 font-extrabold text-lg mb-2">Account Created</h3>
          <p className="text-sm text-neutral-300">Redirecting to sign in...</p>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Username</label>
            <input
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              placeholder="your_username"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Email</label>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              placeholder="you@domain.com"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">Password</label>
            <input
              id="signup-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-lg bg-neutral-900/60 border border-neutral-700 px-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              placeholder="Minimum 8 characters"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-900/40 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Enroll Now'}
          </button>
        </form>
      )}
    </>
  );
}
