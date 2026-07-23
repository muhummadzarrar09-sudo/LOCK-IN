"use client";
import { useEffect, useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

type Team = {
  id: string;
  name: string;
  startup_title?: string;
  startup_pitch?: string;
  startup_stage?: string;
};

type TeamMember = {
  team_id: string;
  user_id: string;
  profiles?: { username: string; email: string };
};

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        // My team memberships
        const { data: myMemberships } = await supabase.from('team_members').select('team_id').eq('user_id', session.user.id);
        const myTeamIds = (myMemberships||[]).map((m:any) => m.team_id);
        setMyTeams(myTeamIds);

        // All teams
        const { data: teamsData } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        setTeams((teamsData as any) || []);

        // Members for my teams (or all if you want) - try fetch with join
        if (myTeamIds.length > 0) {
          const { data: membersData } = await supabase.from('team_members').select('team_id,user_id').in('team_id', myTeamIds);
          // Try to get usernames via profiles
          const userIds = [...new Set((membersData||[]).map((m:any) => m.user_id))];
          const { data: profiles } = await supabase.from('profiles').select('id,username,email').in('id', userIds);
          const profileMap = new Map((profiles||[]).map((p:any) => [p.id, p]));
          const enriched = (membersData||[]).map((m:any) => ({
            ...m,
            profiles: profileMap.get(m.user_id)
          }));
          setMembers(enriched);
        }
      } catch (e) {
        console.warn('team load', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] px-6 pt-12 pb-20 text-white">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tighter">Team</h1>
              <p className="text-[10px] text-neutral-500">Your accountability squads · Live</p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-neutral-500 animate-pulse">Loading teams...</div>
          ) : teams.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 text-center">
              <h3 className="text-sm font-bold mb-2">No teams yet</h3>
              <p className="text-xs text-neutral-500 mb-4">Teams are created by admin or via invites. Your admin can create teams in Supabase `teams` table.</p>
              <p className="text-[11px] text-neutral-600">To create: INSERT INTO teams(name,startup_title) VALUES('Alpha','Project Zenith')</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {teams.map((team) => {
                const teamMembers = members.filter(m => m.team_id === team.id);
                const isMyTeam = myTeams.includes(team.id);
                return (
                  <div key={team.id} className={`rounded-2xl border p-6 ${isMyTeam ? 'border-amber-800/40 bg-amber-950/10' : 'border-neutral-800 bg-[#121212]/60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <h2 className="text-lg font-extrabold">{team.name}</h2>
                      {isMyTeam && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">MY TEAM</span>}
                    </div>
                    <h3 className="text-sm font-bold text-neutral-300 mb-1">{team.startup_title || 'Untitled Startup'}</h3>
                    <p className="text-xs text-neutral-500 mb-3">{team.startup_pitch || 'No pitch yet.'}</p>
                    <div className="inline-flex px-2.5 py-1 rounded-md bg-amber-900/20 text-amber-300 text-[10px] font-extrabold tracking-wide mb-4">STAGE: {(team.startup_stage || 'idea').toUpperCase()}</div>
                    <div className="border-t border-neutral-800 pt-3">
                      <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Members ({teamMembers.length})</h4>
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-neutral-600">No members loaded (RLS may restrict). Run fix-rls-team SQL.</p>
                      ) : (
                        <div className="space-y-1">
                          {teamMembers.map((m) => (
                            <div key={m.user_id} className="text-xs text-neutral-400">
                              {m.profiles?.username || m.user_id.slice(0,8)} {m.user_id === userId && '(you)'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-dashed border-neutral-800 bg-[#121212]/30 p-6 text-center">
            <h4 className="text-xs font-bold text-neutral-400 mb-2">Join Team</h4>
            <p className="text-xs text-neutral-600 mb-3">Team invites via email/username currently manual via Supabase. Insert into `team_members` table.</p>
          </div>
        </div>
      </main>
    </>
  );
}
