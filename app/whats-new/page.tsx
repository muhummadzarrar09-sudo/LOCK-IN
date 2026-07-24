'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, Zap, Award, BarChart3, Users, Bell, Share2, Calendar, Trophy, TrendingUp, Image as ImageIcon, History } from 'lucide-react';
import Navbar from '@/components/Navbar';

type Entry = {
  icon: any;
  title: string;
  body: string;
  tag: 'new' | 'improved' | 'soon';
};

type Section = {
  version: string;
  date: string;
  summary: string;
  entries: Entry[];
};

const SECTIONS: Section[] = [
  {
    version: 'v2.0',
    date: 'Today',
    summary: 'The "ship it" cut. Full social layer, real-time toasts, achievement system, share cards, history view, admin analytics — everything the cohort lead and members need to run a real 30-day execution cohort.',
    entries: [
      { icon: Award, title: 'Achievement celebration', body: 'Unlock a 3/7/14/30/100-day badge and the screen erupts — full-screen modal, OS notification, share card. Silent before. Loud now.', tag: 'new' },
      { icon: Users, title: 'Public profiles + member directory', body: 'See your cohort at /people. Click anyone to land on their /u/[username] page with their badge wall, view count, and a share button.', tag: 'new' },
      { icon: Trophy, title: 'Olympic-style leaderboard podium', body: '2nd, 1st, 3rd in stepped columns. The winner gets the crown. You get a real "where do I stand" answer.', tag: 'new' },
      { icon: BarChart3, title: '30-day execution history', body: 'A 30-square calendar grid at /history. Full days shine, partial days glow, missed days are dim. Hover for the date + count.', tag: 'new' },
      { icon: ImageIcon, title: 'Canvas share cards', body: '1200×1200 PNG with your badge or your streak. Download, copy to clipboard, or share directly. Works on every social.', tag: 'new' },
      { icon: Share2, title: 'Real-time team feed toasts', body: 'When a teammate posts, you get a toast. When admin publishes, you get a toast. The product feels alive.', tag: 'new' },
      { icon: Bell, title: 'Upgraded notification bell', body: 'Click to open. Shows actual items with title + snippet, not just counts. Mark all read.', tag: 'improved' },
      { icon: Sparkles, title: 'Weekly recap modal', body: 'Once a week, the dashboard surfaces your last 7 days: check-ins, best day, badges earned. Throttled via localStorage.', tag: 'new' },
      { icon: TrendingUp, title: 'You vs. the cohort card', body: 'Your rank + rank-delta since last visit + percentile + vs. median + vs. average. Stored locally so it tracks over time.', tag: 'new' },
      { icon: BarChart3, title: 'Admin analytics', body: 'Retention curve, peak check-in hour heatmap, top contributors, members-to-nudge list, cohort health score, CSV export.', tag: 'new' },
      { icon: Zap, title: 'Next-milestone widget', body: 'A gradient progress bar on the dashboard showing the next badge you\u2019re chasing and how many days to go.', tag: 'new' },
      { icon: History, title: 'Replay welcome tour', body: 'Settings has a "Replay welcome" button. Clears onboarding hints + redirects to /welcome. Useful for admins and returning users.', tag: 'new' },
      { icon: Calendar, title: 'Power hour + best day insights', body: 'Two small pills on the dashboard: when you usually check in (hour-of-day) and which day of the week is your strongest.', tag: 'new' },
    ],
  },
  {
    version: 'v1.0',
    date: 'Earlier',
    summary: 'The original launch. Time blocks, check-ins, streaks, teams, reports, community, leaderboard, profile, settings, admin. The full 30-day execution contract.',
    entries: [
      { icon: Sparkles, title: 'Welcome wizard', body: '4 steps: welcome, profile, timezone, Day 1 preview. Sets up the user\u2019s defaults and shows what they signed up for.', tag: 'new' },
      { icon: BarChart3, title: 'Real-time dashboards', body: 'Dashboard, leaderboard, team feed, reports, community, members, history, settings, admin. All Supabase real-time where it matters.', tag: 'new' },
      { icon: Award, title: 'Streak freezes', body: 'Earned automatically at 7/14/21/30 day streaks. Auto-applied to your next missed day so a single miss doesn\u2019t break the chain.', tag: 'new' },
      { icon: Users, title: 'Teams + team feed', body: '3-4 members per squad. Shared startup log. Admin assigns teams. RLS protects team data.', tag: 'new' },
      { icon: Bell, title: 'Browser push notifications', body: 'Notifications API for time-block reminders. Permission requested via the bell. No email, no separate app.', tag: 'new' },
    ],
  },
];

export default function WhatsNewPage() {
  const router = useRouter();
  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2">What\u2019s new</p>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">
              We ship fast.
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
              Every release is logged here. New features, the changes that mattered, the things we fixed. If something looks different, this is why.
            </p>
          </div>

          <div className="space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.version}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-300 bg-amber-500/15 border border-amber-700/30 rounded px-2 py-0.5">
                    {s.version}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                    {s.date}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                  {s.summary}
                </p>
                <ul className="space-y-1.5">
                  {s.entries.map((e, i) => (
                    <li key={i} className="rounded-lg bg-[#121212]/60 border border-neutral-800 p-3 flex items-start gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-md bg-amber-500/15 border border-amber-700/30 flex items-center justify-center mt-0.5">
                        <e.icon className="w-4 h-4 text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-extrabold text-white">{e.title}</p>
                          <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            e.tag === 'new' ? 'bg-emerald-500/20 text-emerald-300' :
                            e.tag === 'improved' ? 'bg-violet-500/20 text-violet-300' :
                            'bg-neutral-800 text-neutral-400'
                          }`}>
                            {e.tag}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed">{e.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-amber-700/30 bg-gradient-to-br from-amber-950/20 to-transparent p-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-2">What\u2019s next</p>
            <h2 className="font-serif text-2xl tracking-tighter text-white mb-2">
              The finished product.
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
              This is the MVP. The full product will have: native push, multi-cohort support, comments + reactions on team feeds, follow + cheer, light theme, and proper onboarding for new cohort leads. We\u2019re shipping those next.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
