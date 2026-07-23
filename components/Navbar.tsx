"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shield, Trophy, Users, FileText, MessageCircle, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setEmail(session.user.email);
      if (session?.user?.id) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (data) setRole((data as any).role);
      }
    };
    loadRole();
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
    ...(role === 'admin' ? [{ label: 'Admin', href: '/admin', icon: Settings }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-border-subtle/50 backdrop-blur-xl bg-[#121212]/70">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10 group-hover:shadow-amber-400/20 transition-all">
            <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tighter leading-none text-white">DISCIPLINE</span>
            <span className="text-[9px] text-neutral-500 tracking-[0.2em] leading-none">COHORT</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-lg text-[11px] font-semibold text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all tracking-wide"
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="ml-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-white hover:bg-neutral-900 flex items-center gap-1.5"
            title={email || 'Sign out'}
          >
            <LogOut className="w-3.5 h-3.5" /> Out
          </button>
        </div>

        {/* Mobile: simple */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={handleSignOut} className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>
    </nav>
  );
}
