import { Users } from 'lucide-react';

export default function TeamPage() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter">Team</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Shared Startup</h3>
            <h2 className="text-xl font-extrabold mb-3">Project Zenith</h2>
            <p className="text-sm text-neutral-400 mb-4">A discipline-focused productivity tool for wealth-builders.</p>
            <div className="inline-flex px-2.5 py-1 rounded-md bg-amber-900/20 text-amber-300 text-[10px] font-extrabold tracking-wide">STAGE: PROTOTYPE</div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6">
            <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-wider mb-4">Team Log</h3>
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="border-b border-neutral-800 pb-2"><span className="text-neutral-500">Jul 22</span> · Started landing page wireframes.</div>
              <div className="border-b border-neutral-800 pb-2"><span className="text-neutral-500">Jul 21</span> · Finalized pitch deck outline.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
