'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X, Check } from 'lucide-react';

const STORAGE_KEY = 'discipline.cookieConsent.v1';

type Consent = 'accepted' | 'rejected' | null;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let saved: Consent = null;
    try { saved = (localStorage.getItem(STORAGE_KEY) || null) as Consent; } catch {}
    if (saved) {
      setConsent(saved);
    } else {
      // Slight delay so it doesn't slam the user on first paint
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const set = (value: 'accepted' | 'rejected') => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
    setConsent(value);
    setVisible(false);
  };

  if (consent) return null;
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 md:left-4 md:right-auto md:max-w-md z-[80] fade-in-up"
    >
      <div className="rounded-2xl border border-neutral-800 bg-[#121212]/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white">Cookies, briefly.</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">
              We use only functional cookies to keep you signed in for your account. No tracking, no ads, no analytics.{' '}
              <Link href="/privacy" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">Privacy policy</Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => set('accepted')}
            className="flex-1 h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            onClick={() => set('rejected')}
            className="h-9 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:border-neutral-600 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
