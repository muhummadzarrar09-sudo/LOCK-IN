"use client";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Users, Clock, MessageSquare, Target, Flame, Radio, Send, Sparkles, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/Skeleton';
import { useRealtimeEvent } from '@/components/CohortRealtime';
import { TeamPulseStats } from '@/components/TeamPulseStats';
import { FreshnessDot } from '@/components/FreshnessDot';

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
  profiles?: { username: string };
};

type MemberStats = {
  current_streak: number;
  best_streak: number;
  locked_today: number;
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
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const myMembershipsRes = await supabase.from('team_members').select('team_id').eq('user_id', session.user.id);
        const myTeamIds = (myMembershipsRes.data || []).map((m: any) => m.team_id);
        setMyTeams(myTeamIds);

        if (myTeamIds.length > 0) {
          const { data: teamsData } = await supabase
            .from('teams')
            .select('id,name,startup_title,startup_pitch,startup_stage')
            .in('id', myTeamIds)
            .order('created_at', { ascending: false });
          setTeams((teamsData as any) || []);
          // Parallel: members of my teams + the team feed logs
          const [membersRes, logsRes] = await Promise.all([
            supabase.from('team_members').select('team_id,user_id').in('team_id', myTeamIds),
            supabase
              .from('team_startup_log')
              .select('id,team_id,user_id,note,created_at')
              .in('team_id', myTeamIds)
              .order('created_at', { ascending: false })
              .limit(30),
          ]);
          const membersData = membersRes.data;
          const logsData = logsRes.data;

          const userIds = [...new Set((membersData || []).map((m: any) => m.user_id))];
          const logUserIds = [...new Set((logsData || []).map((l: any) => l.user_id))];
          // Combined: dedupe + fetch all profiles in one round-trip
          const allUserIds = [...new Set([...userIds, ...logUserIds])];
          if (allUserIds.length > 0) {
            const todayISO = new Date().toISOString().slice(0, 10);
            const [{ data: profiles }, { data: streaks }, { data: todayLocks }] = await Promise.all([
              supabase
                .from('public_profiles')
                .select('id,username')
                .in('id', allUserIds),
              supabase
                .from('streaks')
                .select('user_id,current_streak,best_streak')
                .in('user_id', userIds),
              supabase
                .from('check_ins')
                .select('user_id')
                .in('user_id', userIds)
                .gte('completed_at', `${todayISO}T00:00:00Z`),
            ]);
            const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
            const todayCount = new Map<string, number>();
            (todayLocks || []).forEach((lock: any) => todayCount.set(lock.user_id, (todayCount.get(lock.user_id) || 0) + 1));
            const stats: Record<string, MemberStats> = {};
            (userIds || []).forEach((id) => { stats[id] = { current_streak: 0, best_streak: 0, locked_today: todayCount.get(id) || 0 }; });
            (streaks || []).forEach((s: any) => {
              stats[s.user_id] = {
                current_streak: s.current_streak || 0,
                best_streak: s.best_streak || 0,
                locked_today: todayCount.get(s.user_id) || 0,
              };
            });
            setMemberStats(stats);
            const enriched = (membersData || []).map((m: any) => ({ ...m, profiles: profileMap.get(m.user_id) }));
            setMembers(enriched);
            setLogs((logsData || []).map((l: any) => ({ ...l, profiles: profileMap.get(l.user_id) })));
          } else {
            setMembers([]);
            setLogs([]);
            setMemberStats({});
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

  const handlePost = async (e: React.FormEvent, teamId: string) => {
    e.preventDefault();
    if (!postText.trim() || !userId || !teamId) return;
    setPosting(true);
    const res = await fetch('/api/team/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, note: postText.trim() }),
    });
    if (res.ok) {
      setPostText('');
      // Real-time subscription will refresh; no manual reload needed.
    } else {
      const payload = await res.json().catch(() => ({}));
      console.warn('team log post:', payload.error || 'failed');
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
      const { data: logProfiles } = await supabase.from('public_profiles').select('id,username').in('id', logUserIds);
      const logProfileMap = new Map((logProfiles || []).map((p: any) => [p.id, p]));
      setLogs((logsData as any[]).map((l) => ({ ...l, profiles: logProfileMap.get(l.user_id) })));
    }
  }, [myTeams]);

  // Real-time: refresh team feed when teammates post. Subscribes via the
  // single shared channel (CohortRealtimeProvider) — no local channel
  // setup here.
  useRealtimeEvent('team', () => refreshLogs(), myTeams.length > 0);

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
                  <section key={team.id} className="mb-10 space-y-6">
                    <SquadHero
                      team={team}
                      memberCount={teamMembers.length}
                      lockedToday={teamMembers.reduce((sum, m) => sum + (memberStats[m.user_id]?.locked_today || 0), 0)}
                      proofCount={logs.filter((entry) => entry.team_id === team.id).length}
                    />

                    <MemberGrid
                      members={teamMembers}
                      currentUserId={userId}
                      stats={memberStats}
                    />

                    <TeamPulseStats
                      teamId={team.id}
                      memberUserIds={teamMembers.map((m) => m.user_id)}
                    />

                    <section className="rounded-3xl border border-neutral-800 bg-[radial-gradient(circle_at_top_left,rgba(240,176,48,0.08),transparent_35%),linear-gradient(135deg,rgba(18,18,18,0.86),rgba(13,13,13,0.98))] p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70 font-extrabold flex items-center gap-2">
                            <MessageSquare className="w-3 h-3" /> Proof Feed
                          </p>
                          <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mt-1">What the squad shipped.</h3>
                        </div>
                        <span className="shrink-0 rounded-full border border-neutral-800 bg-black/25 px-3 py-1 text-[10px] font-bold text-neutral-400">
                          {logs.filter((entry) => entry.team_id === team.id).length} proofs
                        </span>
                      </div>

                      <ProofComposer
                        value={postText}
                        posting={posting}
                        onChange={setPostText}
                        onSubmit={(e) => handlePost(e, team.id)}
                      />

                      <ProofTimeline
                        logs={logs.filter((entry) => entry.team_id === team.id)}
                        currentUserId={userId}
                      />
                    </section>
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

function SquadHero({ team, memberCount, lockedToday, proofCount }: { team: Team; memberCount: number; lockedToday: number; proofCount: number }) {
  const stage = STAGE_COPY[team.startup_stage || 'idea'] || STAGE_COPY.idea;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-700/35 bg-[radial-gradient(circle_at_20%_0%,rgba(240,176,48,0.18),transparent_38%),linear-gradient(135deg,rgba(42,31,14,0.62),rgba(13,13,13,0.98))] p-6 md:p-8 shadow-2xl shadow-amber-500/10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/75 font-extrabold flex items-center gap-2 mb-2">
            <Radio className="w-3 h-3" /> Squad Room
          </p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white leading-[0.95] truncate">{team.name}</h2>
        </div>
        <span className={`shrink-0 inline-flex px-3 py-1 rounded-full text-[10px] font-black tracking-[0.18em] uppercase ${stage.color}`}>
          {stage.label}
        </span>
      </div>

      <div className="rounded-2xl border border-amber-800/25 bg-black/25 p-4 md:p-5 mb-5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500 font-bold mb-1">Building</p>
        <h3 className="text-lg md:text-xl font-black text-amber-50 tracking-tight">{team.startup_title || 'Startup thesis forming'}</h3>
        {team.startup_pitch && <p className="text-sm text-amber-100/65 leading-relaxed mt-2 max-w-2xl">{team.startup_pitch}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <SquadStat label="Members" value={String(memberCount)} />
        <SquadStat label="Blocks today" value={String(lockedToday)} />
        <SquadStat label="Proof posts" value={String(proofCount)} />
      </div>
    </section>
  );
}

function SquadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[9px] uppercase tracking-[0.22em] text-white/40 font-bold truncate">{label}</p>
      <p className="text-xl md:text-2xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function MemberGrid({ members, currentUserId, stats }: { members: TeamMember[]; currentUserId: string | null; stats: Record<string, MemberStats> }) {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-[#121212]/60 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-extrabold">Squad</p>
          <h3 className="text-lg font-black text-white mt-1">Visible execution.</h3>
        </div>
        <ShieldCheck className="w-4 h-4 text-neutral-700" />
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-neutral-500">Members will appear here once your squad is fully loaded.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {members.map((member) => {
            const name = member.profiles?.username || member.user_id.slice(0, 6);
            const stat = stats[member.user_id] || { current_streak: 0, best_streak: 0, locked_today: 0 };
            const isYou = member.user_id === currentUserId;
            return (
              <div key={member.user_id} className={`rounded-2xl border p-4 ${isYou ? 'border-amber-500/35 bg-amber-950/15' : 'border-neutral-800 bg-black/20'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black ${isYou ? 'bg-amber-300 text-black' : 'bg-neutral-800 text-neutral-200'}`}>
                    {initials(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white truncate">{name}{isYou && <span className="ml-1 text-amber-300">(you)</span>}</p>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{stat.locked_today}/6 locked today</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/25 border border-neutral-900 p-2">
                    <p className="text-[9px] uppercase tracking-wider text-neutral-600 font-bold">Chain</p>
                    <p className="text-sm font-black text-amber-200 mt-0.5 inline-flex items-center gap-1"><Flame className="w-3 h-3" /> {stat.current_streak}d</p>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-neutral-900 p-2">
                    <p className="text-[9px] uppercase tracking-wider text-neutral-600 font-bold">Best</p>
                    <p className="text-sm font-black text-neutral-200 mt-0.5">{stat.best_streak}d</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProofComposer({ value, posting, onChange, onSubmit }: { value: string; posting: boolean; onChange: (value: string) => void; onSubmit: (e: React.FormEvent) => void }) {
  const prompts = ['What shipped?', 'What got unblocked?', 'What did you learn?'];
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-2xl border border-neutral-800 bg-black/25 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 font-extrabold">Log proof of work</p>
          <p className="text-[11px] text-neutral-500">Visible to your squad.</p>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What moved forward today?"
        rows={3}
        maxLength={2000}
        className="w-full bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none resize-none"
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-900">
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onChange(value ? `${value}\n${prompt} ` : `${prompt} `)} className="h-7 px-2 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors">
              {prompt}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!value.trim() || posting}
          className="h-9 px-4 rounded-lg bg-amber-300 text-black text-xs font-black hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
        >
          <Send className="w-3.5 h-3.5" /> {posting ? 'Logging…' : 'Log proof'}
        </button>
      </div>
    </form>
  );
}

function ProofTimeline({ logs, currentUserId }: { logs: LogEntry[]; currentUserId: string | null }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-800 bg-black/20 p-6 text-center">
        <MessageSquare className="w-5 h-5 text-neutral-700 mx-auto mb-2" />
        <p className="text-sm font-semibold text-neutral-300 mb-1">No proof logged yet.</p>
        <p className="text-xs text-neutral-500">Be the first to show the squad what moved forward.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-1 top-2 bottom-2 w-px bg-gradient-to-b from-amber-500/40 via-neutral-700 to-neutral-900" />
      <div className="space-y-3">
        {logs.map((entry) => {
          const name = entry.profiles?.username || 'Member';
          return (
            <article key={entry.id} className="relative rounded-2xl border border-neutral-800 bg-black/20 p-4 ml-3">
              <div className="absolute -left-[23px] top-5 w-3 h-3 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(240,176,48,0.4)]" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-xl bg-neutral-800 flex items-center justify-center text-[10px] font-black text-neutral-200">
                  {initials(name)}
                </div>
                <span className="text-xs font-black text-neutral-100">{name}</span>
                {entry.user_id === currentUserId && <span className="text-[9px] text-amber-300 font-black uppercase tracking-wider">You</span>}
                <span className="ml-auto text-[10px] text-neutral-500 inline-flex items-center gap-1.5">
                  <FreshnessDot iso={entry.created_at} />
                  <Clock className="w-2.5 h-2.5" /> {timeAgo(entry.created_at)}
                </span>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
            </article>
          );
        })}
      </div>
    </div>
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
          <h3 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">Teams forming in your cohort</h3>
          <p className="text-xs text-neutral-500">
            {otherCount} {otherCount === 1 ? 'squad is' : 'squads are'} being assembled. You&apos;ll see the full roster here once your team is set.
          </p>
        </div>
      )}
    </>
  );
}
