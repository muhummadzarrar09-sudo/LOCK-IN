'use client';

import { AlertTriangle, Check, Sparkles } from 'lucide-react';

type Props = {
  onSeeded?: () => void;
};

/**
 * Demo seeding is intentionally disabled in the browser.
 * Bulk data creation/deletion must run through a locked server-side operator
 * workflow so production data is never wiped from the UI by accident.
 */
export function DemoSeedTab(props: Props) {
  void props;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/30 to-amber-900/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <h2 className="text-sm font-extrabold text-amber-100">Demo seed</h2>
        </div>
        <p className="text-xs text-amber-200/80 leading-relaxed mb-5">
          Browser-based demo seeding is disabled. Bulk seed operations require a protected operator workflow with typed confirmation and audit logging.
        </p>

        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 flex items-start gap-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-extrabold text-red-200 mb-1">Client-side seeding blocked</h3>
            <p className="text-xs text-red-200/70 leading-relaxed">
              This protects production data and keeps demo resets out of the browser.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 font-semibold text-sm cursor-not-allowed inline-flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Seed demo data disabled
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5">
        <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Recommended replacement</h3>
        <ul className="text-xs text-neutral-300 space-y-1.5 leading-relaxed">
          <li>· Create a server-only operator action.</li>
          <li>· Require typing <span className="font-mono text-amber-200">RESET DEMO DATA</span> for destructive resets.</li>
          <li>· Log every seed and reset operation.</li>
          <li>· Allow the action only in approved demo environments.</li>
        </ul>
        <p className="text-[10px] text-emerald-300/70 mt-4 inline-flex items-center gap-1">
          <Check className="w-3 h-3" />
          Safe: no bulk browser writes are performed from this tab.
        </p>
      </div>
    </div>
  );
}
