import { Trophy } from 'lucide-react';

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10">
            <Trophy className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter">Leaderboard</h1>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
          <h2 className="text-sm font-extrabold mb-2">Ranked by Streak</h2>
          <p className="text-xs text-neutral-500 mb-6">Only members with active check-ins appear. Your rank updates in real time.</p>
          <div className="space-y-3 text-sm text-neutral-400">
            <div className="flex justify-between border-b border-neutral-800 pb-2"><span>1. member_alpha</span><span className="text-amber-300 font-black">28</span></div>
            <div className="flex justify-between border-b border-neutral-800 pb-2"><span>2. member_beta</span><span className="text-amber-300 font-black">24</span></div>
            <div className="flex justify-between border-b border-neutral-800 pb-2"><span>3. member_gamma</span><span className="text-amber-300 font-black">19</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}
