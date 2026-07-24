import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Clock, Users, Trophy, CheckCircle2 } from 'lucide-react';

// Landing page is fully static — generated at build time, served from edge
// forever. The marketing copy rarely changes; when it does, redeploy.
export const dynamic = 'force-static';
export const revalidate = false;

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] selection:bg-amber-500/20">
      {/* Top nav (landing) */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
              <ShieldCheck className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tighter leading-none text-white">DISCIPLINE</span>
              <span className="text-[9px] text-neutral-500 tracking-[0.2em] leading-none mt-0.5">COHORT</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/whats-new" className="hidden md:inline-flex h-9 px-3 items-center text-[11px] font-bold uppercase tracking-wider text-amber-300/80 hover:text-amber-200 transition-colors">
              What’s new
            </Link>
            <Link href="/auth/login" className="h-9 px-3 md:px-4 inline-flex items-center text-[11px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/auth/signup" className="h-9 px-3 md:px-4 inline-flex items-center text-[11px] font-extrabold uppercase tracking-wider bg-amber-400 text-black rounded-lg hover:bg-amber-300 transition-colors">
              Enroll
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-32 md:pt-40 pb-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-amber-400/[0.025] blur-[150px]" />
          <div className="absolute bottom-[-20%] left-[-30%] w-[60vw] h-[60vw] rounded-full bg-amber-700/[0.02] blur-[150px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-900/30 text-amber-300 text-[10px] font-extrabold tracking-[0.2em] uppercase mb-8">
            <Zap className="w-3 h-3" /> 30-Day Cohort — MVP Ready
          </div>

          <p className="text-amber-300/90 text-sm md:text-base font-semibold tracking-wide mb-4 uppercase text-[11px]">
            You bought the course. Now finish the build.
          </p>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tighter mb-6">
            Discipline is not <br />
            <span className="italic text-amber-300">a habit.</span><br />
            It&apos;s a contract.
          </h1>
          <p className="text-neutral-400 text-lg md:text-xl max-w-xl leading-relaxed mb-10">
            A 30-day execution cohort for serious builders. Time-blocked days. Visible streaks. Teams of 3. Your team sees everything. Real consequences.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-8">
            <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2.5 h-12 px-8 rounded-xl bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/10">
              Enroll in the cohort <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/login" className="h-12 px-8 rounded-xl border border-neutral-700 text-neutral-300 font-semibold text-sm hover:bg-[#161616] hover:text-white transition-all inline-flex items-center justify-center">
              I&apos;m already a member
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500 border-t border-neutral-900 pt-6">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-neutral-300 font-bold">Members only</span> · No ads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-neutral-300 font-bold">30 days</span> · One team
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-neutral-300 font-bold">One contract</span>
            </span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-neutral-900">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold mb-3">How it works</p>
        <h2 className="font-serif text-3xl md:text-5xl tracking-tighter leading-[0.95] mb-4 max-w-2xl">
          Three mechanisms.<br />
          <span className="italic text-amber-300">One outcome:</span> you ship.
        </h2>
        <p className="text-neutral-400 text-base max-w-xl leading-relaxed mb-12">
          The cohort day is structured around ultradian rhythms — 90-minute focus cycles your brain already runs on. Check in as you complete each block. Your team watches. Your streak compounds.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Clock}
            title="Time-Blocked Days"
            desc="Deep work, protected breaks, movement, reflection. Auto-localized to your timezone. Default schedule is the contract."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Visible Streaks"
            desc="Mark each block complete. Missed blocks visibly break the streak. No passive tracking — active discipline."
          />
          <FeatureCard
            icon={Users}
            title="Teams of 3"
            desc="Squad-based accountability. Shared startup idea. Shared progress log. Your team sees every check-in."
          />
        </div>
      </section>

      {/* What's inside */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-neutral-900">
        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold mb-3">What you get</p>
        <h2 className="font-serif text-3xl md:text-5xl tracking-tighter leading-[0.95] mb-12 max-w-2xl">
          Everything you need to <span className="italic text-amber-300">actually ship.</span>
        </h2>

        <div className="space-y-3">
          {[
            'Time-blocked day, default schedule based on ultradian research',
            'Visible streak that breaks when you skip — and your team sees it',
            'Squad of 3 with a shared startup idea and shared progress log',
            'Curated reports and frameworks from your cohort lead',
            'Real-time leaderboard ranked by streak, not vanity metrics',
            'Installable PWA — works offline, on your phone, in the bathroom at 6 AM',
          ].map((line) => (
            <div key={line} className="flex items-start gap-3 rounded-xl border border-neutral-900 bg-[#121212]/40 p-4">
              <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" strokeWidth={2.2} />
              <p className="text-sm text-neutral-200 leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-neutral-900">
        <div className="rounded-3xl border border-amber-900/30 bg-gradient-to-br from-amber-950/20 to-transparent p-8 md:p-12 text-center">
          <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-4" strokeWidth={1.8} />
          <h2 className="font-serif text-3xl md:text-5xl tracking-tighter leading-[0.95] mb-4">
            The cohort starts <span className="italic text-amber-300">soon.</span>
          </h2>
          <p className="text-neutral-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
            30 days. 6 blocks per day. One team. One contract. No refunds, no extensions, no excuses.
          </p>
          <Link href="/auth/signup" className="inline-flex items-center justify-center gap-2.5 h-12 px-8 rounded-xl bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/10">
            Enroll Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-neutral-900 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
        <span className="font-semibold tracking-wider">DISCIPLINE COHORT</span>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span>Members only · No ads · Built for builders</span>
          <Link href="/whats-new" className="hover:text-amber-300 transition-colors font-semibold">What’s new</Link>
          <Link href="/privacy" className="hover:text-amber-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-amber-300 transition-colors">Terms</Link>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl border border-neutral-800 bg-[#121212]/40 hover:border-neutral-700 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
        <Icon className="w-4 h-4 text-amber-300" strokeWidth={2.2} />
      </div>
      <h3 className="text-sm font-extrabold mb-2 tracking-tight text-white">{title}</h3>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}
