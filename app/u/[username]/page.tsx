"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Flame, Trophy, Award, Sparkles, Target, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { initials, relativeTime } from '@/lib/ui';

type ProfileData = {
  id: string;
  username: string;
  role: string;
  created_at: string;
  streak: { current_streak: number; best_streak: number; last_check_in_date: string | null } | null;
  achievements: { code: string; earned_at: string }[];
  team: { team_id: string; name: string; startup_title: string | null } | null;
};

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = (params.username as string)?.toLowerCase();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);
      setNotFound(false);
      // Look up profile by username
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, username, role, created_at')
        .eq('username', username)
        .maybeSingle();
      if (profErr || !prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // Fetch streak
      const { data: streakData } = await supabase
        .from('streaks')
        .select('current_streak, best_streak, last_check_in_date')
        .eq('user_id', prof.id)
        .maybeSingle();
      // Fetch achievements
      const { data: achData } = await supabase
        .from('achievements')
        .select('code, earned_at')
        .eq('user_id', prof.id)
        .order('earned_at', { ascending: false });
      // Fetch team (just one)
      const { data: teamData } = await supabase
        .from('team_members')
        .select('team_id, teams:teams!inner(name, startup_title)')
        .eq('user_id', prof.id)
        .limit(1)
        .maybeSingle();

      setProfile({
        ...(prof as any),
        streak: streakData as any,
        achievements: (achData as any[]) || [],
        team: teamData
          ? { team_id: (teamData as any).team_id, name: (teamData as any).teams?.name, startup_title: (teamData as any).teams?.startup_title }
          : null,
      });
      setLoading(false);

      // Log profile view
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user.id !== prof.id) {
          await supabase.from('profile_views').insert({
            viewed_user_id: prof.id,
            viewer_user_id: session.user.id,
          } as any);
        }
      } catch { /* non-fatal */ }
    })();
  }, [username]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
          <div className="text-neutral-500 text-sm animate-pulse">Loading profile…</div>
        </main>
      </>
    );
  }

  if (notFound || !profile) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold mb-3">404</p>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tighter text-white mb-3">No such member.</h1>
            <p className="text-sm text-neutral-400 mb-6">
              We couldn&apos;t find <span className="font-mono text-amber-300">@{username}</span>.
            </p>
            <Link href="/people" className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-4">
              Browse all members →
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
        <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 md:pt-12 pb-24">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>

          {/* Profile header */}
          <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-amber-950/20 to-transparent p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-lg font-extrabold text-black">
                {initials(profile.username)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tighter text-white truncate">{profile.username}</h1>
                  {profile.role === 'admin' && (
                    <span className="text-[9px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatCard
              icon={<Flame className="w-4 h-4 text-amber-400" />}
              label="Current streak"
              value={profile.streak?.current_streak ?? 0}
              suffix="days"
            />
            <StatCard
              icon={<Trophy className="w-4 h-4 text-amber-400" />}
              label="Best streak"
              value={profile.streak?.best_streak ?? 0}
              suffix="days"
            />
            <StatCard
              icon={<Sparkles className="w-4 h-4 text-amber-400" />}
              label="Achievements"
              value={profile.achievements.length}
              suffix="earned"
            />
          </div>

          {/* Team */}
          {profile.team && (
            <section className="mb-6 rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-300" />
                <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Team</h2>
              </div>
              <p className="text-base font-extrabold text-white mb-1">{profile.team.name}</p>
              {profile.team.startup_title && (
                <p className="text-xs text-neutral-400">Building: {profile.team.startup_title}</p>
              )}
            </section>
          )}

          {/* Achievements */}
          {profile.achievements.length > 0 && (
            <section className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-amber-300" />
                <h2 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em]">Achievements</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {profile.achievements.map((a) => (
                  <div key={a.code} className="rounded-lg border border-amber-700/30 bg-amber-950/15 p-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-400/15 flex items-center justify-center text-amber-300 text-xs font-extrabold shrink-0">
                      ★
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-amber-100 truncate">{achievementLabel(a.code)}</p>
                      <p className="text-[9px] text-neutral-500">{relativeTime(a.earned_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state if no achievements yet */}
          {profile.achievements.length === 0 && (
            <section className="rounded-2xl border border-dashed border-neutral-800 bg-[#121212]/30 p-5 text-center">
              <Activity className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-500">
                {profile.username} hasn&apos;t earned any achievements yet. Check in to get the first one.
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">{label}</span>
      </div>
      <p className="text-2xl font-black text-amber-100">
        {value}
        <span className="text-[10px] text-neutral-500 font-bold ml-1.5 uppercase">{suffix}</span>
      </p>
    </div>
  );
}

function achievementLabel(code: string): string {
  const map: Record<string, string> = {
    streak_3: '3-day streak',
    streak_7: 'Week of discipline',
    streak_14: 'Fortnight',
    streak_30: 'Cohort complete',
    streak_100: 'Triple digits',
  };
  return map[code] || code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
