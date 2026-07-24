'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DISMISS_KEY = 'discipline.adminBanner.dismissed.v1';

/**
 * Sticky banner that appears on non-admin pages for users with the
 * 'admin' role. Reminds them they have admin power and offers a
 * one-tap return to the admin panel. Dismissable per session via
 * localStorage. The user can still reach the admin panel via the
 * Navbar — this is just a clearer affordance when they're elsewhere.
 */
export function AdminViewBanner() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show on admin pages themselves, or on auth/landing
    if (pathname?.startsWith('/admin')) return;
    if (pathname?.startsWith('/auth')) return;
    if (pathname === '/') return;
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch { /* ignore */ }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if ((prof as any)?.role === 'admin') setIsAdmin(true);
    })();
  }, [pathname]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (!isAdmin || dismissed) return null;

  return (
    <div className="sticky top-16 z-40 bg-amber-500/10 border-b border-amber-700/30 backdrop-blur">
      <div className="max-w-5xl mx-auto px-5 md:px-6 py-2 flex items-center gap-2.5">
        <Shield className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        <p className="text-[11px] text-amber-100 font-semibold tracking-wide flex-1 min-w-0 truncate">
          You&apos;re viewing as a member. Your admin tools are one tap away.
        </p>
        <Link
          href="/admin"
          className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 hover:text-amber-200 underline underline-offset-2 shrink-0"
        >
          Open admin
        </Link>
        <button
          onClick={dismiss}
          className="shrink-0 -mr-1 p-1 text-amber-300/70 hover:text-amber-200 rounded transition-colors"
          aria-label="Dismiss for this session"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
