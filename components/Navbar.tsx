import Link from 'next/link';
import { Shield, Trophy, Users, FileText, MessageCircle, Menu } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-border-subtle/50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10 group-hover:shadow-amber-400/20 transition-all">
            <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tighter leading-none text-text-primary">DISCIPLINE</span>
            <span className="text-[9px] text-text-muted tracking-[0.2em] leading-none">COHORT</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {[
            { label: 'Schedule', href: '/dashboard', icon: Shield },
            { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
            { label: 'Team', href: '/team', icon: Users },
            { label: 'Reports', href: '/reports', icon: FileText },
            { label: 'Community', href: '/community', icon: MessageCircle },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-lg text-[11px] font-semibold text-text-secondary hover:text-text-primary hover:bg-surface transition-all tracking-wide"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
