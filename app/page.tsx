import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Clock } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] selection:bg-amber-500/20">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-32 pb-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-amber-400/[0.025] blur-[150px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/20 border border-amber-900/30 text-amber-300 text-[10px] font-extrabold tracking-[0.2em] uppercase mb-8">
            <Zap className="w-3 h-3" /> 30-Day Cohort — Enrollment Open
          </div>

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.9] tracking-tighter mb-6">
            Discipline is not <br />
            <span className="italic text-amber-300">a habit.</span><br />
            It's a contract.
          </h1>
          <p className="text-neutral-400 text-lg md:text-xl max-w-xl leading-relaxed mb-10">
            A strict, premium accountability community for serious wealth-building. Daily time blocks. Zero excuses. Visible streaks. Real consequences.
          </p>

          <div className="flex items-center gap-4">
            <Link href="/auth/signup" className="inline-flex items-center gap-2.5 h-12 px-8 rounded-xl bg-amber-400 text-black font-extrabold text-sm tracking-wide hover:bg-amber-300 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/10">
              Enroll Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/auth/login" className="h-12 px-8 rounded-xl border border-neutral-700 text-neutral-300 font-semibold text-sm hover:bg-surface hover:text-white transition-all">
              Member Access
            </Link>
          </div>
        </div>
      </section>

      {/* Features — concentrated, not diluted */}
      <section className="max-w-4xl mx-auto px-6 py-24 border-t border-neutral-900">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Clock,
              title: 'Time-Blocked Days',
              desc: 'Evidence-based schedule: deep work, protected breaks, movement, reflection. Auto-localized to your timezone.',
            },
            {
              icon: ShieldCheck,
              title: 'Strict Check-Ins',
              desc: 'Mark each block complete. Missed blocks visibly break the streak. No passive tracking — active discipline.',
            },
            {
              icon: Zap,
              title: 'Team Accountability',
              desc: 'Groups of 3–4. Shared startup idea. Shared progress log. Your team sees everything.',
            },
          ].map((f) => (
            <div key={f.title} className="p-7 rounded-2xl border border-neutral-800 bg-[#121212]/40 hover:border-neutral-700 transition-colors">
              <f.icon className="w-6 h-6 text-amber-400 mb-5" strokeWidth={2} />
              <h3 className="text-base font-extrabold mb-3 tracking-tight">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-neutral-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-600">
        <span>Discipline Cohort. Members Only. No Ads.</span>
        <span>Support: support@accountability.com</span>
      </footer>
    </main>
  );
}
