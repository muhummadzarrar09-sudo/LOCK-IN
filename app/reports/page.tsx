import { FileText } from 'lucide-react';

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter">Reports</h1>
        </div>
        <div className="space-y-4">
          {[
            { title: 'Interview Report: Wealth Discipline (Jul 2026)', date: 'Jul 20', cached: true },
            { title: 'Presentation: The 90-Minute Deep Work Protocol', date: 'Jul 18', cached: true },
            { title: 'Interview: Building Teams That Hold You Accountable', date: 'Jul 15', cached: true },
          ].map((r) => (
            <a key={r.title} href="#" className="block rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6 hover:border-neutral-600 transition-colors group">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-extrabold group-hover:text-amber-200 transition-colors">{r.title}</h3>
                <span className="text-[10px] text-neutral-600 font-mono">{r.date}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400">CACHED</span>
                <span>Available offline</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
