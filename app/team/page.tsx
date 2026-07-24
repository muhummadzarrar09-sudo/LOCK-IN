"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Users, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { useRealtimeTableIn } from '@/lib/realtime';
import { TeamPulseStats } from '@/components/TeamPulseStats';

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

type LogEntry = {
  id: string;
  team_id: string;
  user_id: string;
  note: string;
  created_at: string;
  profiles?: { username: string };
};

const STAGE_COPY: Record<string, { label: string; color: string }> = {
  idea: { label: 'Idea', color: 'bg-neutral-800 text-neutral-300' },
  prototype: { label: 'Prototype', color: 'bg-amber-900/30 text-amber-200 border border-amber-800/30' },
  revenue: { label: 'Revenue', color: 'bg-emerald-900/30 text-emerald-200 border border-emerald-800/30' },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeams, setMyTeams] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: myMemberships } = await supabase.from('team_members').select('team_id').eq('user_id', session.user.id);
        const myTeamIds = (myMemberships || []).map((m: any) => m.team_id);
        setMyTeams(myTeamIds);

        const { data: teamsData } = await supabase.from('teams').select('*').order('created_at', { ascending: false });
        setTeams((teamsData as any) || []);

        if (myTeamIds.length > 0) {
          const { data: membersData } = await supabase.from('team_members').select('team_id,user_id').in('team_id', myTeamIds);
          const userIds = [...new Set((membersData || []).map((m: any) => m.user_id))];
          const { data: profiles } = await supabase.from('profiles').select('id,username,email').in('id', userIds);
          const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
          const enriched = (membersData || []).map((m: any) => ({ ...m, profiles: profileMap.get(m.user_id) }));
          setMembers(enriched);

          // Team feed (startup log)
          const { data: logsData } = await supabase
            .from('team_startup_log')
            .select('id,team_id,user_id,note,created_at')
            .in('team_id', myTeamIds)
            .order('created_at', { ascending: false })
            .limit(30);
          if (logsData) {
            const logUserIds = [...new Set((logsData as any[]).map((l) => l.user_id))];
            const { data: logProfiles } = await supabase.from('profiles').select('id,username').in('id', logUserIds);
            const logProfileMap = new Map((logProfiles || []).map((p: any) => [p.id, p]));
            setLogs((logsData as any[]).map((l) => ({ ...l, profiles: logProfileMap.get(l.user_id) })));
          }
        }
      } catch (e) {
        console.warn('team load', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const myTeamObjects = useMemo(() => teams.filter(t => myTeams.includes(t.id)), [teams, myTeams]);
  const otherTeams = useMemo(() => teams.filter(t => !myTeams.includes(t.id)), [teams, myTeams]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() || !userId || myTeams.length === 0) return;
    setPosting(true);
    // Post to the first team the user is a member of
    const teamId = myTeams[0];
    const { error } = await supabase.from('team_startup_log').insert({
      team_id: teamId,
      user_id: userId,
      note: postText.trim(),
    } as any);
    if (!error) {
      setPostText('');
      // Real-time subscription will refresh; no manual reload needed.
    } else {
      console.warn('team log post:', error.message);
    }
    setPosting(false);
  };

  // Real-time: refresh team feed when teammates post
  const refreshLogs = useCallback(async () => {
    if (myTeams.length === 0) return;
    const { data: logsData } = await supabase
      .from('team_startup_log')
      .select('id,team_id,user_id,note,created_at')
      .in('team_id', myTeams)
      .order('created_at', { ascending: false })
      .limit(30);
    if (logsData) {
      const logUserIds = [...new Set((logsData as any[]).map((l) => l.user_id))];
      const { data: logProfiles } = await supabase.from('profiles').select('id,username').in('id', logUserIds);
      const logProfileMap = new Map((logProfiles || []).map((p: any) => [p.id, p]));
      setLogs((logsData as any[]).map((l) => ({ ...l, profiles: logProfileMap.get(l.user_id) })));
    }
  }, [myTeams]);

  useRealtimeTableIn('team_startup_log', 'INSERT', 'team_id', myTeams, refreshLogs, [refreshLogs, myTeams]);

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] px-5 md:px-6 pt-8 md:pt-12 pb-24 text-white">
        <div className="max-w-3xl mx-auto">
          <PageHeader
            icon={Users}
            title="Team"
            subtitle="Your accountability squad · Ships together"
          />

          {loading ? (
            <SkeletonList rows={3} />
          ) : myTeams.length === 0 && teams.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Your team is being assigned"
              description="Your cohort lead will assign you to a squad of 3–4 before Day 1. You'll get a notification when your team is set."
              primaryAction={{ label: 'Go to dashboard', href: '/dashboard' }}
            />
          ) : myTeams.length === 0 ? (
            <NotOnTeamState otherCount={teams.length} />
          ) : (
            <>
              {/* Your team(s) */}
              {myTeamObjects.map((team) => {
                const teamMembers = members.filter(m => m.team_id === team.id);
                return (
                  <section key={team.id} className="mb-10">
                    <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/30 to-amber-900/10 p-6 md:p-8 mb-6">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80 font-bold mb-1">Your Team</p>
                          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-white">{team.name}</h2>
                        </div>
                        <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider ${STAGE_COPY[team.startup_stage || 'idea']?.color || STAGE_COPY.idea.color}`}>
                          {STAGE_COPY[team.startup_stage || 'idea']?.label || 'Idea'}
                        </span>
                      </div>
                      {team.startup_title && (
                        <p className="text-base text-amber-100 font-semibold mb-1">Building: {team.startup_title}</p>
                      )}
                      {team.startup_pitch && (
                        <p className="text-sm text-neutral-400 leading-relaxed mb-4">{team.startup_pitch}</p>
                      )}
                      <div className="border-t border-amber-800/20 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-3">
                          Squad ({teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'})
                        </p>
                        {teamMembers.length === 0 ? (
                          <p className="text-xs text-neutral-500">Members will appear here once your team is fully loaded.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {teamMembers.map((m) => {
                              const name = m.profiles?.username || m.user_id.slice(0, 6);
                              return (
                                <div
                                  key={m.user_id}
                                  className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border ${
                                    m.user_id === userId
                                      ? 'bg-amber-500/15 border-amber-500/30'
                                      : 'bg-neutral-900/50 border-neutral-800'
                                  }`}
                                >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                    m.user_id === userId ? 'bg-amber-400 text-black' : 'bg-neutral-800 text-neutral-300'
                                  }`}>
                                    {initials(name)}
                                  </div>
                                  <span className={`text-xs font-semibold ${m.user_id === userId ? 'text-amber-100' : 'text-neutral-300'}`}>
                                    {name}{m.user_id === userId && <span className="text-amber-400 ml-1">(you)</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team pulse: collective stats */}
                    <TeamPulseStats
                      teamId={team.id}
                      memberUserIds={teamMembers.map((m) => m.user_id)}
                    />

                    {/* Team feed */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <MessageSquare className="w-3 h-3" /> Team Feed
                        </h3>
                        <span className="text-[10px] text-neutral-500">{logs.length} updates</span>
                      </div>

                      {/* Post input */}
                      <form onSubmit={handlePost} className="mb-5 rounded-xl border border-neutral-800 bg-[#121212]/60 p-3">
                        <textarea
                          value={postText}
                          onChange={(e) => setPostText(e.target.value)}
                          placeholder="What did you ship today?"
                          rows={2}
                          className="w-full bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none resize-none"
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
                          <span className="text-[10px] text-neutral-500">Visible to your team</span>
                          <button
                            type="submit"
                            disabled={!postText.trim() || posting}
                            className="h-8 px-3 rounded-md bg-amber-400 text-black text-xs font-extrabold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {posting ? 'Posting…' : 'Post Update'}
                          </button>
                        </div>
                      </form>

                      {logs.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-800 bg-[#121212]/30 p-6 text-center">
                          <p className="text-xs text-neutral-500">No team updates yet. Be the first to post.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {logs.map((entry) => {
                            const name = entry.profiles?.username || 'Member';
                            return (
                              <div key={entry.id} className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-4">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] font-extrabold text-neutral-300">
                                    {initials(name)}
                                  </div>
                                  <span className="text-xs font-semibold text-neutral-200">{name}</span>
                                  {entry.user_id === userId && <span className="text-[9px] text-amber-300 font-bold">YOU</span>}
                                  <span className="ml-auto text-[10px] text-neutral-500 inline-flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> {timeAgo(entry.created_at)}
                                  </span>
                                </div>
                                <p className="text-sm text-neutral-300 leading-relaxed pl-8">{entry.note}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}

              {/* Other teams in cohort */}
              {otherTeams.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-4">
                    Other teams in your cohort
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {otherTeams.map((team) => (
                      <div key={team.id} className="rounded-xl border border-neutral-800 bg-[#121212]/40 p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-extrabold text-white truncate">{team.name}</h4>
                          <span className={`shrink-0 inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold tracking-wider ${STAGE_COPY[team.startup_stage || 'idea']?.color || STAGE_COPY.idea.color}`}>
                            {STAGE_COPY[team.startup_stage || 'idea']?.label || 'Idea'}
                          </span>
                        </div>
                        {team.startup_title && (
                          <p className="text-xs text-neutral-400 truncate">{team.startup_title}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function NotOnTeamState({ otherCount }: { otherCount: number }) {
  return (
    <>
      <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 md:p-8 mb-6">
        <h3 className="text-base font-extrabold mb-2 text-amber-100">You haven&apos;t been assigned to a team yet</h3>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Your cohort lead will assign you to a squad before Day 1. Teams are 3–4 members working on a shared startup idea.
        </p>
      </div>
      {otherCount > 0 && (
        <div>
          <h3 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Teams in the cohort</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* This branch reuses OtherTeams rendering — kept minimal for now */}
            <p className="text-xs text-neutral-500">Teams are forming. Check back after Day 1.</p>
          </div>
        </div>
      )}
    </>
  );
}
