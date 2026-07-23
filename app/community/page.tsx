import { MessageCircle } from 'lucide-react';

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tighter">Community</h1>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
          <p className="text-xs text-neutral-500 uppercase tracking-[0.2em] mb-4">Read-Only Mirror</p>
          <h2 className="text-base font-extrabold mb-3">Cohort Announcements</h2>
          <div className="text-left space-y-4 text-sm text-neutral-300">
            <div className="border-b border-neutral-800 pb-3">
              <h4 className="font-bold text-amber-200 mb-1">New Cohort Start: Aug 1</h4>
              <p className="text-xs text-neutral-500">Prepare your schedule template. Deep work blocks begin at 06:00 local time.</p>
            </div>
            <div>
              <h4 className="font-bold text-text-primary mb-1">Reminder: Check-ins are active</h4>
              <p className="text-xs text-neutral-500">Missed blocks break streaks. Team visibility is live.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
