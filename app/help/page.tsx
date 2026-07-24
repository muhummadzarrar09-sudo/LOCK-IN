'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ChevronDown, MessageCircle, Mail, LifeBuoy, BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';

type FaqItem = {
  q: string;
  a: string | React.ReactNode;
  cat: 'getting-started' | 'cohort' | 'team' | 'account';
};

const FAQ: FaqItem[] = [
  // Getting started
  { cat: 'getting-started', q: 'What is a "30-day cohort"?', a: 'A fixed group of members who start the 30-day execution program on the same day. You check in to time blocks daily, your team sees your progress, and you ship together. After 30 days, the cohort closes. A new one starts the following month.' },
  { cat: 'getting-started', q: 'What happens on Day 1?', a: <>Your first 6 time blocks unlock at 06:00 in your local timezone. You check in to each block as you complete it. Your team sees your check-ins in real time. By end of Day 1, you should have a full day of evidence that you showed up.</> },
  { cat: 'getting-started', q: 'I missed a block. Now what?', a: 'Tap the block in your dashboard. You can check in late — but the streak reflects what really happened. We don\'t fudge the numbers. The good news: tomorrow is a new day.' },
  { cat: 'getting-started', q: 'Do I need to use this at exactly 06:00?', a: <>No. Your time blocks are scheduled for your timezone, but you can check in at any time during or after the block. The "now" highlight just shows which block is current.</> },

  // Cohort
  { cat: 'cohort', q: 'What is a time block?', a: 'A scheduled chunk of time (usually 90–180 minutes) where you focus on a specific activity. The default schedule is: 06:00 deep work, 09:00 break, 09:30 deep work, 12:00 movement, 12:30 reflection, 13:00 deep work. You can customize your own schedule in the dashboard.' },
  { cat: 'cohort', q: 'What does "streak" mean?', a: 'The number of consecutive days you\'ve checked in to at least one block. A streak breaks when you miss an entire day. Your best streak is the longest streak you\'ve ever achieved.' },
  { cat: 'cohort', q: 'How are the leaderboard rankings calculated?', a: 'Members are ranked by their current streak. Ties are broken by username (alphabetical). The cohort average is shown so you can see how you compare.' },
  { cat: 'cohort', q: 'Can I be in more than one cohort?', a: <>No. The cohort is meant to be a 30-day focused commitment. You can re-enroll in a future cohort after your current one ends.</> },

  // Team
  { cat: 'team', q: 'How are teams assigned?', a: 'Your cohort lead assigns you to a squad of 3–4 members before Day 1. Teams are formed based on the startup idea you\'re working on, so you\'re accountable to people building the same kind of thing.' },
  { cat: 'team', q: 'What is the team feed?', a: 'A shared log where your teammates post updates on what they shipped. It\'s a low-friction way to stay in sync without needing to schedule calls. The "What did you ship today?" input on the Team page is how you post.' },
  { cat: 'team', q: 'Can I change teams?', a: <>Not during a cohort. Teams are intentionally stable for the 30 days. If there\'s a real issue, contact your cohort lead.</> },
  { cat: 'team', q: 'Who can see my team feed posts?', a: 'Only your team. The team feed is private to your squad. The public community feed (announcements from your cohort lead) is different — that\'s everyone.' },

  // Account
  { cat: 'account', q: 'How do I change my username?', a: <>Go to <Link href="/settings" className="text-amber-300 hover:text-amber-200 underline">Settings</Link>, click Edit next to your username, change it, and save. Your new name shows up immediately on the leaderboard and team feed.</> },
  { cat: 'account', q: 'How do I change my timezone?', a: <>Settings → Edit profile → change timezone. The dashboard uses this for time-block scheduling. If you travel, update it and the dashboard recalculates your "now" highlight.</> },
  { cat: 'account', q: 'How do I delete my account?', a: <>Go to <Link href="/settings/delete" className="text-amber-300 hover:text-amber-200 underline">Settings → Delete account</Link>. We\'ll ask you to confirm, then permanently delete your profile, check-ins, team feed posts, and streaks. This is irreversible.</> },
  { cat: 'account', q: 'I\'m not getting reminders. What\'s wrong?', a: <>Open <Link href="/settings" className="text-amber-300 hover:text-amber-200 underline">Settings → Reminders</Link>. You\'ll see a permission banner if your browser is blocking notifications. Click "Enable reminders" and approve the browser prompt.</> },
  { cat: 'account', q: 'Can I export my data?', a: <>Email <a href="mailto:support@accountability.com" className="text-amber-300 hover:text-amber-200 underline">support@accountability.com</a> and we\'ll send you a JSON export of your profile, check-ins, streaks, and team feed posts within 48 hours.</> },
];

const CATS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'cohort', label: 'Cohort & schedule' },
  { id: 'team', label: 'Team' },
  { id: 'account', label: 'Account' },
] as const;

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(0);
  const [activeCat, setActiveCat] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    let list = FAQ;
    if (activeCat !== 'all') list = list.filter((f) => f.cat === activeCat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((f) => f.q.toLowerCase().includes(q) || (typeof f.a === 'string' && f.a.toLowerCase().includes(q)));
    }
    return list.map((item, i) => ({ ...item, _idx: i }));
  }, [query, activeCat]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
        <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 md:pt-12 pb-24">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-700/30 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-white">Help & FAQ</h1>
              <p className="text-[11px] text-neutral-500">Answers to the most common questions.</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for an answer…"
              className="w-full h-11 pl-10 pr-4 rounded-lg bg-neutral-900/60 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              aria-label="Search FAQ"
            />
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-1.5 mb-6 overflow-x-auto -mx-5 px-5 md:mx-0 md:px-0">
            <button
              onClick={() => setActiveCat('all')}
              className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
                activeCat === 'all' ? 'bg-amber-400 text-black' : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              All
            </button>
            {CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-bold transition-colors ${
                  activeCat === c.id ? 'bg-amber-400 text-black' : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* FAQ list */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
              <p className="text-sm text-neutral-300 mb-1 font-semibold">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-500">Try a different search term or contact support below.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const open = openId === item._idx;
                return (
                  <div key={item._idx} className="rounded-xl border border-neutral-800 bg-[#121212]/60 overflow-hidden">
                    <button
                      onClick={() => setOpenId(open ? null : item._idx)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-neutral-900/30 transition-colors"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-semibold text-white">{item.q}</span>
                      <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-0 text-sm text-neutral-300 leading-relaxed border-t border-neutral-900">
                        <div className="pt-3">{item.a}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Still need help */}
          <section className="mt-10 rounded-2xl border border-amber-700/30 bg-amber-950/10 p-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-amber-100 mb-1">Still stuck?</h2>
                <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                  We&apos;re here. Real humans, real answers, usually within a few hours.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="mailto:support@accountability.com"
                    className="h-9 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 inline-flex items-center gap-2 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email support
                  </a>
                  <Link
                    href="/settings?report=1"
                    className="h-9 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:border-neutral-600 inline-flex items-center gap-2 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Report a problem
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
