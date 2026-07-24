'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Home, Trophy, Users, FileText, MessageCircle, LifeBuoy, Settings, Sliders, LogIn, UserPlus, X, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  group: 'Navigate' | 'Search' | 'Members';
  // For members: the user id (used to mark 'you' and to navigate to /u/:username)
  meta?: Record<string, any>;
};

const STATIC_ITEMS: Item[] = [
  { id: 'home', label: 'Home', hint: 'Landing page', href: '/', icon: <Home className="w-4 h-4" />, group: 'Navigate' },
  { id: 'dash', label: 'Dashboard', hint: 'Today\'s time blocks', href: '/dashboard', icon: <Home className="w-4 h-4" />, group: 'Navigate' },
  { id: 'leader', label: 'Leaderboard', hint: 'Cohort rankings', href: '/leaderboard', icon: <Trophy className="w-4 h-4" />, group: 'Navigate' },
  { id: 'people', label: 'Members', hint: 'Browse all members', href: '/people', icon: <Users className="w-4 h-4" />, group: 'Navigate' },
  { id: 'team', label: 'Team', hint: 'Your squad', href: '/team', icon: <Users className="w-4 h-4" />, group: 'Navigate' },
  { id: 'reports', label: 'Reports', hint: 'Curated frameworks', href: '/reports', icon: <FileText className="w-4 h-4" />, group: 'Navigate' },
  { id: 'community', label: 'Community', hint: 'Announcements', href: '/community', icon: <MessageCircle className="w-4 h-4" />, group: 'Navigate' },
  { id: 'help', label: 'Help & FAQ', hint: 'Common questions', href: '/help', icon: <LifeBuoy className="w-4 h-4" />, group: 'Navigate' },
  { id: 'settings', label: 'Settings', hint: 'Profile, reminders', href: '/settings', icon: <Sliders className="w-4 h-4" />, group: 'Navigate' },
  { id: 'login', label: 'Sign in', href: '/auth/login', icon: <LogIn className="w-4 h-4" />, group: 'Navigate' },
  { id: 'signup', label: 'Create account', href: '/auth/signup', icon: <UserPlus className="w-4 h-4" />, group: 'Navigate' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Item[]>([]);
  const [active, setActive] = useState(0);

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) { setQuery(''); setActive(0); }
  }, [open]);

  // Search members when query has 2+ chars
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const q = query.toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${q}%`)
        .limit(8);
      if (data) {
        setMemberResults(data.map((m: any) => ({
          id: `m-${m.id}`,
          label: m.username,
          hint: 'Member',
          href: `/u/${m.username}`,
          icon: <Users className="w-4 h-4" />,
          group: 'Members',
          meta: m,
        })));
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const staticResults = useMemo(() => {
    if (!query.trim()) return STATIC_ITEMS;
    const q = query.toLowerCase();
    return STATIC_ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
  }, [query]);

  const results = useMemo(() => [...staticResults, ...memberResults], [staticResults, memberResults]);

  // Keep active in bounds
  useEffect(() => {
    if (active >= results.length) setActive(0);
  }, [results, active]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active].href);
    }
  }, [active, results, go]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#121212] shadow-2xl shadow-black/50 fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="relative border-b border-neutral-800">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search members, navigate, find anything…"
            className="w-full h-14 pl-12 pr-12 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-neutral-800 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-neutral-500">
              <Sparkles className="w-5 h-5 text-neutral-700 mx-auto mb-2" />
              {query.trim() ? 'No matches.' : 'Type to search.'}
            </div>
          ) : (
            <ResultsList
              items={results}
              active={active}
              onHover={setActive}
              onSelect={go}
            />
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-neutral-800 px-4 py-2 flex items-center gap-3 text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto opacity-60">⌘K</span>
        </div>
      </div>
    </div>
  );
}

function ResultsList({ items, active, onHover, onSelect }: { items: Item[]; active: number; onHover: (i: number) => void; onSelect: (href: string) => void }) {
  // Group by group
  const groups: Record<string, Item[]> = {};
  items.forEach((i) => {
    (groups[i.group] ||= []).push(i);
  });
  return (
    <>
      {Object.entries(groups).map(([group, list]) => (
        <div key={group} className="py-1">
          <div className="px-4 py-1.5 text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-extrabold">
            {group}
          </div>
          {list.map((item) => {
            const globalIdx = items.indexOf(item);
            const isActive = globalIdx === active;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.href)}
                onMouseEnter={() => onHover(globalIdx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  isActive ? 'bg-amber-500/10 text-amber-100' : 'text-neutral-200 hover:bg-neutral-900/60'
                }`}
              >
                <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                  isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-900 text-neutral-500'
                }`}>
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{item.label}</p>
                  {item.hint && (
                    <p className="text-[10px] text-neutral-500 truncate">{item.hint}</p>
                  )}
                </div>
                <ArrowRight className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-neutral-600'}`} />
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
