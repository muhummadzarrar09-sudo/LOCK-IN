"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Trophy, Users, FileText, MessageCircle, Settings, LogOut, Menu, X, Sliders, LifeBuoy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NotificationBell } from './NotificationBell';

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setEmail(session.user.email);
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (data) setRole((data as any).role);
      }
    };
    loadRole();
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  const navItems = [
    { label: 'Schedule', href: '/dashboard', icon: Shield },
    { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { label: 'Team', href: '/team', icon: Users },
    { label: 'Reports', href: '/reports', icon: FileText },
    { label: 'Community', href: '/community', icon: MessageCircle },
    { label: 'Help', href: '/help', icon: LifeBuoy },
    { label: 'Settings', href: '/settings', icon: Sliders },
    ...(role === 'admin' ? [{ label: 'Admin', href: '/admin', icon: Settings }] : []),
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname?.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      <nav className="sticky top-0 z-50 glass-panel border-b border-border-subtle/50 backdrop-blur-xl bg-[#121212]/70" aria-label="Primary">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" aria-label="Discipline — go to dashboard">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10 group-hover:shadow-amber-400/20 transition-all">
              <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tighter leading-none text-white">DISCIPLINE</span>
              <span className="text-[9px] text-neutral-500 tracking-[0.2em] leading-none">COHORT</span>
            </div>
          </Link>

          {/* Desktop nav (md and up) */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all ${
                    active
                      ? 'text-amber-300 bg-amber-500/10'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-1"><NotificationBell userId={userId} /></div>
            <button
              onClick={handleSignOut}
              className="ml-1 px-3 py-2 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900 flex items-center gap-1.5"
              title={email || 'Sign out'}
            >
              <LogOut className="w-3.5 h-3.5" /> Out
            </button>
          </div>

          {/* Mobile: hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              <Menu className="w-4 h-4 text-neutral-200" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer (below md) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer panel */}
          <div
            id="mobile-nav-drawer"
            className="absolute right-0 top-0 h-full w-[82%] max-w-sm bg-[#0D0D0D] border-l border-neutral-800 shadow-2xl flex flex-col drawer-slide-in"
          >
            {/* Drawer header */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-neutral-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <span id="mobile-nav-title" className="text-sm font-extrabold tracking-tighter leading-none text-white">DISCIPLINE</span>
                  <span className="text-[9px] text-neutral-500 tracking-[0.2em] leading-none mt-0.5">COHORT</span>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-4 h-4 text-neutral-300" />
              </button>
            </div>

            {/* User chip */}
            {email && (
              <div className="px-5 py-3 border-b border-neutral-900">
                <div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] mb-1">Signed in as</div>
                <div className="text-xs text-neutral-200 truncate">{email}</div>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto py-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 px-5 py-3.5 text-sm font-semibold transition-colors ${
                      active
                        ? 'text-amber-300 bg-amber-500/10 border-l-2 border-amber-400'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-900/60 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-neutral-500'}`} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Footer: sign out */}
            <div className="p-4 border-t border-neutral-900 flex items-center gap-2">
              <div className="flex-1"><NotificationBell userId={userId} /></div>
              <button
                onClick={handleSignOut}
                className="flex-1 h-11 rounded-lg bg-neutral-900 border border-neutral-800 text-sm font-semibold text-neutral-300 hover:text-white hover:border-neutral-600 flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
