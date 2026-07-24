import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] selection:bg-amber-500/30 flex items-center justify-center px-6 py-12">
      {/* Premium background texture — softer on mobile, slightly stronger on desktop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-amber-500/[0.015] md:bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-amber-400/[0.015] md:bg-amber-400/[0.03] blur-[120px]" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="mb-8 md:mb-10 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-extrabold tracking-tighter text-amber-400 mb-2">DISCIPLINE</h1>
          </Link>
          <p className="text-neutral-400 text-xs tracking-[0.2em] uppercase">30-Day Execution Cohort</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-neutral-700" />
            <span className="text-[10px] text-neutral-600 tracking-[0.3em] uppercase">Members Only</span>
            <span className="h-px w-8 bg-neutral-700" />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-[#121212]/85 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-black/50">
          {children}
        </div>
      </main>
    </div>
  );
}
