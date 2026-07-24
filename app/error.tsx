'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (production: send to monitoring)
    console.error('App error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center fade-in-up">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-700/30 mx-auto mb-5 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-300" />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">
          Something broke.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-2">
          We hit an unexpected error. Your progress is safe — give it another try, or head back home.
        </p>
        {error.digest && (
          <p className="text-[10px] text-neutral-600 font-mono mb-6">
            ref: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="h-11 px-5 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 inline-flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <Link
            href="/"
            className="h-11 px-5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>
      </div>
    </main>
  );
}
