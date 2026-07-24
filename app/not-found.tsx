import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center fade-in-up">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-700/30 mx-auto mb-5 flex items-center justify-center">
          <Compass className="w-6 h-6 text-amber-300" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3">404 — Off the map</p>
        <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">
          You went off-script.
        </h1>
        <p className="text-sm text-neutral-400 leading-relaxed mb-6">
          The page you&apos;re looking for doesn&apos;t exist. Maybe a typo, maybe it moved, maybe the cohort is still forming.
        </p>
        <Link
          href="/"
          className="h-11 px-5 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to landing
        </Link>
      </div>
    </main>
  );
}
