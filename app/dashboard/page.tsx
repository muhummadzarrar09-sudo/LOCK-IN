"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, XCircle, Flame, Shield, LogOut, Info, X, Sparkles, Trophy, PartyPopper, Share2, Calendar, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PageHeader from '@/components/PageHeader';
import StreakChip from '@/components/StreakChip';
import { useCurrentTime, isWithin, toMinutes } from '@/lib/useCurrentTime';
import { loadPrefs, requestPermission, scheduleAllBlockReminders, scheduleDailyStart, cancelAllBlockReminders } from '@/lib/reminders';
import { OnboardingHint } from '@/components/OnboardingHint';
import { StreakFreezeBanner } from '@/components/StreakFreezeBanner';
import { AchievementCelebration } from '@/components/AchievementCelebration';
import { DashboardTeamPulse } from '@/components/DashboardTeamPulse';
import { NextMilestone } from '@/components/NextMilestone';
import { WeeklyRecapModal } from '@/components/WeeklyRecapModal';
import { CohortComparison } from '@/components/CohortComparison';
import { ShareCardModal } from '@/components/ShareCardModal';
import { WeekProgressRing } from '@/components/WeekProgressRing';
import { BestTimeInsight } from '@/components/BestTimeInsight';
import { BestDayInsight } from '@/components/BestDayInsight';
import { useToast } from '@/components/Toast';
import { ACHIEVEMENTS, AchievementCode, getAchievement } from '@/lib/achievements';

type BlockType = 'work' | 'break' | 'movement' | 'reflection';

type Block = {
  id: string;
  db_id?: string;
  label: string;
  block_type: BlockType;
  start: string;
  end: string;
  completed: boolean;
  day?: number;
};

const DEFAULT_TEMPLATE: Omit<Block, 'id' | 'completed'>[] = [
  { label: 'Deep Work Block 1', block_type: 'work', start: '06:00', end: '09:00', day: 1 },
  { label: 'Protected Break', block_type: 'break', start: '09:00', end: '09:30', day: 1 },
  { label: 'Deep Work Block 2', block_type: 'work', start: '09:30', end: '12:00', day: 1 },
  { label: 'Movement', block_type: 'movement', start: '12:00', end: '12:30', day: 1 },
  { label: 'Reflection / Journal', block_type: 'reflection', start: '12:30', end: '13:00', day: 1 },
  { label: 'Deep Work Block 3', block_type: 'work', start: '13:00', end: '16:00', day: 1 },
];

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timezone, setTimezone] = useState('');
  const [today, setToday] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<{ username: string; created_at?: string } | null>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [justCheckedId, setJustCheckedId] = useState<string | null>(null);
  const [celebrateCode, setCelebrateCode] = useState<AchievementCode | null>(null);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [totalCheckIns, setTotalCheckIns] = useState(0);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [myTeamName, setMyTeamName] = useState<string | null>(null);
  // Snapshot of earned achievements, taken right after a check-in.
  // Used to diff against the previous snapshot to detect NEW achievements.
  const earnedBeforeRef = useRef<Set<string>>(new Set());

  const now = useCurrentTime(60_000);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setToday(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.push('/auth/login?redirect=/dashboard');
          return;
        }
        const uid = session.user.id;
        setUserId(uid);
        if (session.user.email) setUserEmail(session.user.email);

        // Role (loaded but not currently surfaced on dashboard; available for future use)
        const { data: prof } = await supabase.from('profiles').select('role, username, created_at').eq('id', uid).maybeSingle();
        if (prof) {
          setProfile({ username: (prof as any).username || '', created_at: (prof as any).created_at });
        }

        // Active cohort (enrollment_open=true or current date in range)
        const { data: cohortData } = await supabase
          .from('cohorts')
          .select('*')
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cohortData) setCohort(cohortData as any);

        // Streak
        const { data: streakData } = await supabase.from('streaks').select('current_streak, best_streak').eq('user_id', uid).maybeSingle();
        if (streakData) {
          setStreak((streakData as any).current_streak || 0);
          setBestStreak((streakData as any).best_streak || 0);
        }

        // Snapshot earned achievements — used to detect a NEW unlock on check-in
        const { data: earned } = await supabase.from('achievements').select('code').eq('user_id', uid);
        earnedBeforeRef.current = new Set((earned || []).map((a: any) => a.code));

        // Total check-ins (for share card + lifetime counter)
        const { count: tci } = await supabase
          .from('check_ins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid);
        setTotalCheckIns(tci || 0);

        // Load team memberships for the team pulse card
        const { data: myMemberships } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', uid);
        const teamIds = (myMemberships || []).map((m: any) => m.team_id);
        setMyTeamIds(teamIds);
        if (teamIds.length > 0) {
          const { data: myTeam } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamIds[0])
            .maybeSingle();
          if (myTeam) setMyTeamName((myTeam as any).name);
        }

        // Time blocks
        await loadOrCreateTimeBlocks(uid);

        // Reminders: request permission once, then schedule today's blocks.
        // Permission prompt is intentionally NOT auto-shown — user can enable via
        // the bell in the nav. But we schedule if already granted.
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const prefs = loadPrefs();
          // Defer to next tick so the freshly-loaded blocks are in state
          setTimeout(() => {
            scheduleAllBlockReminders(blocks, prefs);
            scheduleDailyStart(blocks, prefs);
          }, 100);
        }

      } catch (e) {
        console.error('Dashboard init error', e);
      } finally {
        setLoadingAuth(false);
      }
    };
    init();
  }, [router]);

  const loadOrCreateTimeBlocks = async (uid: string) => {
    setLoadingBlocks(true);
    try {
      // Try fetch existing blocks for user
      const { data: existingBlocks, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', uid)
        .order('start_time', { ascending: true });

      if (error) {
        console.warn('time_blocks fetch error:', error.message);
      }

      let dbBlocks = existingBlocks || [];

      // If none, create from template
      if (dbBlocks.length === 0) {
        const toInsert = DEFAULT_TEMPLATE.map(t => ({
          user_id: uid,
          day: t.day || 1,
          start_time: t.start,
          end_time: t.end,
          label: t.label,
          block_type: t.block_type,
        }));
        const { data: inserted, error: insertError } = await supabase
          .from('time_blocks')
          .insert(toInsert as any)
          .select();

        if (insertError) {
          console.warn('time_blocks insert error:', insertError.message);
          // If conflict (already exists), re-fetch
          const { data: retry } = await supabase.from('time_blocks').select('*').eq('user_id', uid).order('start_time');
          dbBlocks = retry || [];
        } else {
          dbBlocks = inserted || [];
        }
      }

      // Fetch check_ins to know completed status
      const blockIds = dbBlocks.map((b: any) => b.id);
      let checkInsMap = new Set<string>();
      if (blockIds.length > 0) {
        const { data: checkIns } = await supabase
          .from('check_ins')
          .select('time_block_id')
          .eq('user_id', uid)
          .in('time_block_id', blockIds);
        if (checkIns) {
          checkInsMap = new Set(checkIns.map((c: any) => c.time_block_id));
        }
      }

      const mapped: Block[] = dbBlocks.map((b: any) => ({
        id: b.id,
        db_id: b.id,
        label: b.label,
        block_type: b.block_type,
        start: b.start_time?.slice(0,5) || b.start_time,
        end: b.end_time?.slice(0,5) || b.end_time,
        day: b.day,
        completed: checkInsMap.has(b.id),
      }));

      setBlocks(mapped.length > 0 ? mapped : DEFAULT_TEMPLATE.map((t,i) => ({
        id: `temp-${i}`,
        label: t.label,
        block_type: t.block_type,
        start: t.start,
        end: t.end,
        completed: false,
        day: t.day
      })));

    } finally {
      setLoadingBlocks(false);
    }
  };

  const handleCheckIn = async (blockId: string) => {
    if (!userId) return;
    const target = blocks.find(b => b.id === blockId);
    if (!target) return;

    const newCompleted = !target.completed;
    const newBlocks = blocks.map(b => b.id === blockId ? { ...b, completed: newCompleted } : b);
    setBlocks(newBlocks);

    if (newCompleted) {
      setJustCheckedId(blockId);
      setTimeout(() => setJustCheckedId(null), 1200);
    }

    // Persist
    try {
      const realId = target.db_id || target.id;
      if (!target.db_id && realId.startsWith('temp-')) {
        console.warn('Block has no DB id yet, cannot persist check-in');
        return;
      }

    if (newCompleted) {
      const wasFirstEver = totalCheckIns === 0;
      const { error } = await (supabase.from('check_ins') as any).upsert({
        user_id: userId,
        time_block_id: realId,
        completed_at: new Date().toISOString(),
        missed: false,
      }, { onConflict: 'user_id,time_block_id' });
      if (error) {
        console.warn('check_in upsert error:', error.message);
      } else {
        setTotalCheckIns((n) => n + 1);
        // First-ever check-in: small celebratory toast (the Achievement modal
        // only fires on streak milestones, but the very first check-in is
        // a separate memorable moment).
        if (wasFirstEver) {
          toast.success('First check-in logged. The streak begins.');
        }
        setTimeout(async () => {
            const { data } = await supabase.from('streaks').select('current_streak, best_streak').eq('user_id', userId).maybeSingle();
            if (data) {
              setStreak((data as any).current_streak || 0);
              setBestStreak((data as any).best_streak || 0);
            }
            // Diff achievements: detect a NEW unlock triggered by this check-in.
            // The trigger runs on streak UPDATE so we wait briefly for it.
            const { data: newEarned } = await supabase
              .from('achievements')
              .select('code')
              .eq('user_id', userId);
            const newCodes = (newEarned || []).map((a: any) => a.code);
            const newlyUnlocked = newCodes.find(
              (c: string) => !earnedBeforeRef.current.has(c) && ACHIEVEMENTS[c as AchievementCode]
            );
            if (newlyUnlocked) {
              setCelebrateCode(newlyUnlocked as AchievementCode);
              earnedBeforeRef.current.add(newlyUnlocked);
            }
          }, 700);
        }
      } else {
        const { error } = await supabase.from('check_ins').delete().eq('user_id', userId).eq('time_block_id', realId);
        if (error) console.warn('check_in delete error:', error.message);
      }
    } catch (err) {
      console.warn('Check-in error', err);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  // Cohort day calculation. When no active cohort is loaded, the strip is hidden.
  const cohortDayInfo = useMemo(() => {
    if (!cohort || !cohort.start_date || !cohort.end_date) {
      return { dayNumber: 0, isPreCohort: false, isPostCohort: false, daysUntilStart: 0, total: 0, hidden: true };
    }
    const start = new Date(`${cohort.start_date}T00:00:00Z`);
    const end = new Date(`${cohort.end_date}T23:59:59Z`);
    const now = new Date();
    const totalMs = end.getTime() - start.getTime();
    const total = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)));
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const dayNumber = diffDays + 1;
    const isPreCohort = dayNumber < 1;
    const isPostCohort = dayNumber > total;
    const clampedDay = Math.max(1, Math.min(total, dayNumber));
    const daysUntilStart = isPreCohort ? Math.ceil(-diffDays) : 0;
    return { dayNumber: clampedDay, isPreCohort, isPostCohort, daysUntilStart, total, hidden: false };
  }, [cohort]);

  const completedCount = blocks.filter(b => b.completed).length;
  const totalCount = blocks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  // Find current / next block
  const currentBlock = useMemo(() => {
    return blocks.find(b => isWithin(now, b.start, b.end));
  }, [blocks, now]);

  const nextBlock = useMemo(() => {
    const upcoming = blocks
      .filter(b => toMinutes(b.start) > toMinutes(now))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    return upcoming[0];
  }, [blocks, now]);

  // Set of past (missed-eligible) block ids — time has passed and block not completed
  const pastBlocks = useMemo(() => {
    const past = new Set<string>();
    blocks.forEach(b => {
      if (!b.completed && toMinutes(now) > toMinutes(b.end)) past.add(b.id);
    });
    return past;
  }, [blocks, now]);

  // Re-schedule block reminders whenever the block list changes (after init).
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (blocks.length === 0) return;
    if (loadingBlocks) return;
    const prefs = loadPrefs();
    scheduleAllBlockReminders(blocks, prefs);
    scheduleDailyStart(blocks, prefs);
    return () => cancelAllBlockReminders();
  }, [blocks, loadingBlocks]);

  if (loadingAuth) {
    return (
      <main id="main-content" className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-neutral-500 text-sm animate-pulse">Loading…</div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
        <div className="max-w-3xl mx-auto px-5 md:px-6 pt-8 md:pt-12 pb-24">
          {/* Header row: title + streak + signout */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-white">Today</h1>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                  aria-label="How the cohort works"
                  title="How the cohort works"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 tracking-wide truncate">
                {today}{timezone ? ` · ${timezone}` : ''}
              </p>
              {totalCheckIns > 0 && (
                <p className="text-[10px] text-amber-300/70 font-bold tracking-wide mt-0.5">
                  {totalCheckIns} {totalCheckIns === 1 ? 'check-in' : 'check-ins'} · lifetime
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <BestTimeInsight userId={userId || ''} />
                <BestDayInsight userId={userId || ''} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div data-onboarding="streak"><StreakChip streak={streak} best={bestStreak} showBest={bestStreak > 0} /></div>
              <a
                href="/history"
                className="hidden sm:inline-flex h-9 px-2.5 items-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-bold text-neutral-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                title="30-day history"
              >
                <Calendar className="w-3.5 h-3.5" />
                History
              </a>
              <button
                onClick={() => setShareCardOpen(true)}
                className="hidden sm:inline-flex h-9 px-2.5 items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-500/30 text-[11px] font-bold text-amber-300 hover:bg-amber-400/15 transition-colors"
                title="Get a 1200x1200 share card"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Share
              </button>
              <button
                onClick={handleSignOut}
                className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center hover:border-neutral-600 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          </div>

          {/* Streak freeze banner (if user has unused freezes) */}
          <StreakFreezeBanner />

          {/* Welcome banner — only for first-day users */}
          {profile?.created_at && (Date.now() - new Date(profile.created_at).getTime()) < 24 * 60 * 60 * 1000 && (
            <div className="mt-4 mb-2 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-amber-950/10 p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0">
                  <span className="text-2xl">👋</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">Welcome to the cohort</p>
                  <h2 className="text-lg md:text-xl font-extrabold text-amber-100 mt-1 leading-tight">
                    You&rsquo;re in. Here&rsquo;s the deal.
                  </h2>
                  <p className="text-xs text-amber-200/80 leading-relaxed mt-2">
                    Six time blocks per day. Check in when you finish one. Your team sees everything. The streak compounds. That&rsquo;s it.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next milestone widget — shows the next badge in the user's path */}
          <div className="mt-4 mb-2">
            <NextMilestone currentStreak={streak} />
          </div>

          {/* Day X of 30 strip (demo mode only) */}
          {!cohortDayInfo.hidden && !cohortDayInfo.isPreCohort && !cohortDayInfo.isPostCohort && (
            <div className="mt-4 mb-6 rounded-xl border border-neutral-800 bg-[#121212]/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">Cohort Day</span>
                  <span className="text-base font-extrabold text-amber-200">{cohortDayInfo.dayNumber} <span className="text-neutral-600 text-xs">of {cohortDayInfo.total}</span></span>
                </div>
                <span className="text-[10px] text-neutral-500">{cohortDayInfo.total - cohortDayInfo.dayNumber} days remaining</span>
              </div>
              <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${(cohortDayInfo.dayNumber / cohortDayInfo.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {!cohortDayInfo.hidden && cohortDayInfo.isPreCohort && (
            <div className="mt-4 mb-6 rounded-xl border border-amber-900/30 bg-amber-950/20 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-amber-100 mb-1">Cohort starts in {cohortDayInfo.daysUntilStart} day{cohortDayInfo.daysUntilStart === 1 ? '' : 's'}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Here&apos;s a preview of your Day 1. Your first check-in unlocks at 06:00 local time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Post-cohort celebration */}
          {!cohortDayInfo.hidden && cohortDayInfo.isPostCohort && (
            <CohortCompleteCard
              streak={streak}
              bestStreak={bestStreak}
              totalDays={cohortDayInfo.total}
            />
          )}

          {/* Cohort comparison: rank, percentile, head-to-head */}
          {!cohortDayInfo.isPreCohort && !cohortDayInfo.isPostCohort && (
            <div className="grid md:grid-cols-2 gap-3 mb-2">
              <CohortComparison
                userId={userId || ''}
                currentStreak={streak}
                currentBest={bestStreak}
              />
              <WeekProgressRing userId={userId || ''} />
            </div>
          )}

          {/* Primary CTA: the "now" question */}
          {!cohortDayInfo.isPreCohort && !cohortDayInfo.isPostCohort && (
            <div className="mb-6" data-onboarding="now">
              {allDone ? (
                <DayCompleteCard
                  streak={streak}
                  bestStreak={bestStreak}
                  completedCount={completedCount}
                />
              ) : currentBlock ? (
                <PrimaryNowCard
                  block={currentBlock}
                  onCheckIn={() => handleCheckIn(currentBlock.id)}
                  justChecked={justCheckedId === currentBlock.id}
                />
              ) : nextBlock ? (
                <PrimaryNextCard block={nextBlock} now={now} />
              ) : (
                <PrimaryEmptyCard />
              )}
            </div>
          )}

          {/* All blocks list — hidden in pre-cohort (Day 1 preview shown via strip above) */}
          {!cohortDayInfo.isPreCohort && (
            <section data-onboarding="blocks">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-[0.2em]">
                  Today&apos;s blocks
                </h2>
                {!loadingBlocks && totalCount > 0 && (
                  <span className="text-[10px] text-neutral-500">
                    {completedCount} of {totalCount} done
                  </span>
                )}
              </div>
              {loadingBlocks ? (
                <div className="text-sm text-neutral-500 animate-pulse">Loading blocks…</div>
              ) : blocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 bg-[#121212]/30 p-6 text-center">
                  <p className="text-sm text-neutral-300 mb-1 font-semibold">No blocks set up yet</p>
                  <p className="text-xs text-neutral-500">Your schedule will appear here once Day 1 begins.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {blocks.map((block) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      isCurrent={currentBlock?.id === block.id}
                      isNext={nextBlock?.id === block.id}
                      isPast={pastBlocks.has(block.id)}
                      onCheckIn={() => handleCheckIn(block.id)}
                      justChecked={justCheckedId === block.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Team pulse — only renders if user is on a team with posts */}
          <DashboardTeamPulse
            userId={userId || ''}
            teamIds={myTeamIds}
            teamName={myTeamName || undefined}
          />
        </div>
      </main>

      <OnboardingHint />

      {/* Weekly recap modal — shows once per week on the dashboard */}
      <WeeklyRecapModal />

      {/* Share card generator — opens via the Share button in the header
          or from the achievement celebration modal. */}
      <ShareCardModal
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        username={profile?.username || null}
        streak={streak}
        bestStreak={bestStreak}
        totalCheckIns={totalCheckIns}
        cohortDay={cohortDayInfo.hidden ? undefined : cohortDayInfo.dayNumber}
      />

      {/* Achievement celebration — shown when a new badge is unlocked */}
      <AchievementCelebration
        code={celebrateCode}
        onClose={() => setCelebrateCode(null)}
        username={profile?.username || null}
      />

      {/* Help modal — replaces the static "Evidence-Based Structure" panel */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5" onClick={() => setHelpOpen(false)}>
          <div
            className="max-w-lg w-full rounded-2xl border border-neutral-800 bg-[#121212] p-6 md:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold mb-1">How it works</p>
                <h2 className="text-lg font-extrabold tracking-tight">Evidence-based structure</h2>
              </div>
              <button onClick={() => setHelpOpen(false)} className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center" aria-label="Close">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-neutral-300 leading-relaxed">
              <p>
                <span className="text-amber-300 font-bold">Deep work blocks</span> (90–180 min) align with ultradian rhythms — the natural 90-minute focus cycles your brain runs on.
              </p>
              <p>
                <span className="text-amber-300 font-bold">Protected breaks</span> prevent decision fatigue. Step away from the screen, walk, hydrate.
              </p>
              <p>
                <span className="text-amber-300 font-bold">Movement</span> resets cognition. Even 20 minutes restores executive function.
              </p>
              <p>
                <span className="text-amber-300 font-bold">Reflection</span> encodes learning. Write what shipped, what didn&apos;t, what changes tomorrow.
              </p>
              <p className="text-xs text-neutral-500 pt-2 border-t border-neutral-800">
                This is not a template. It is the default contract of the cohort.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryNowCard({ block, onCheckIn, justChecked }: { block: Block; onCheckIn: () => void; justChecked: boolean }) {
  return (
    <button
      onClick={onCheckIn}
      className={`w-full text-left rounded-2xl border p-5 md:p-6 transition-all ${
        block.completed
          ? 'bg-emerald-950/20 border-emerald-800/40'
          : 'bg-gradient-to-br from-amber-500/15 to-amber-700/10 border-amber-500/40 hover:border-amber-400/60 shadow-lg shadow-amber-500/5'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> Now
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
          {block.start} — {block.end}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-lg md:text-xl font-extrabold tracking-tight ${block.completed ? 'text-emerald-200' : 'text-white'}`}>
          {block.label}
        </h3>
        {block.completed ? (
          <span className="text-emerald-300"><CheckCircle2 className="w-6 h-6" strokeWidth={2.2} /></span>
        ) : (
          <span className={`text-amber-300 text-xs font-bold uppercase tracking-wider ${justChecked ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
            Check in →
          </span>
        )}
      </div>
    </button>
  );
}

function PrimaryNextCard({ block, now }: { block: Block; now: string }) {
  const minutesUntil = toMinutes(block.start) - toMinutes(now);
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  const countdown = hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`;

  return (
    <div className="w-full text-left rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-[10px] font-extrabold uppercase tracking-wider">
          Next up
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">
          {block.start} — {block.end} · {countdown}
        </span>
      </div>
      <h3 className="text-lg md:text-xl font-extrabold tracking-tight text-white">{block.label}</h3>
    </div>
  );
}

function PrimaryEmptyCard() {
  return (
    <div className="w-full text-left rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5 md:p-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 text-[10px] font-extrabold uppercase tracking-wider">
          All blocks done
        </span>
      </div>
      <h3 className="text-lg font-extrabold tracking-tight text-white">You&apos;re ahead of the day.</h3>
    </div>
  );
}

function CohortCompleteCard({ streak, bestStreak, totalDays }: { streak: number; bestStreak: number; totalDays: number }) {
  const handleShare = async () => {
    const text = `I just completed the ${totalDays}-day Discipline Cohort. ${streak > 0 ? `${streak}-day streak.` : 'In the books.'} 30 days. Visible streaks. Teams of 3. The contract.`;
    const shareData = { title: 'Discipline Cohort Complete', text };
    try {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav && typeof nav.share === 'function') {
        await nav.share(shareData);
      } else if (nav && nav.clipboard) {
        await nav.clipboard.writeText(text);
        alert('Copied to clipboard.');
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="w-full text-left rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-amber-950/10 p-6 md:p-10 shadow-2xl shadow-amber-500/5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
          <PartyPopper className="w-5 h-5 text-amber-300" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-100 text-[10px] font-extrabold uppercase tracking-wider">
          Cohort Complete
        </span>
      </div>
      <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-amber-100 mb-3 leading-[0.95]">
        You did it.
      </h2>
      <p className="text-base text-amber-200/80 mb-6 max-w-md leading-relaxed">
        {totalDays} days. The contract is closed. You shipped, you showed up, your team saw everything. That&apos;s the product.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-6 max-w-sm">
        <div className="rounded-xl bg-black/30 border border-amber-500/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70 font-bold">Final streak</p>
          <p className="text-2xl font-black text-amber-100 mt-1">{streak}</p>
        </div>
        <div className="rounded-xl bg-black/30 border border-amber-500/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70 font-bold">Best streak</p>
          <p className="text-2xl font-black text-amber-100 mt-1">{bestStreak}</p>
        </div>
      </div>
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 transition-colors"
      >
        <Share2 className="w-4 h-4" /> Share your completion
      </button>
    </div>
  );
}

function DayCompleteCard({ streak, bestStreak, completedCount }: { streak: number; bestStreak: number; completedCount: number }) {
  return (
    <div className="w-full text-left rounded-2xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950/30 to-emerald-900/10 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-emerald-300" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
          Day complete
        </span>
      </div>
      <h3 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-emerald-100 mb-1">
        All {completedCount} blocks done.
      </h3>
      <p className="text-sm text-emerald-200/80 mb-4">
        Streak protected. {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} and counting.` : 'A new streak begins tomorrow.'}
      </p>
      {bestStreak > 0 && (
        <div className="inline-flex items-center gap-2 text-xs text-emerald-300/80">
          <Trophy className="w-3.5 h-3.5" />
          <span>Best streak: {bestStreak} days</span>
        </div>
      )}
    </div>
  );
}

function BlockRow({ block, isCurrent, isNext, isPast, onCheckIn, justChecked }: {
  block: Block;
  isCurrent: boolean;
  isNext: boolean;
  isPast: boolean;
  onCheckIn: () => void;
  justChecked: boolean;
}) {
  const typeColor: Record<BlockType, string> = {
    work: 'text-amber-300',
    break: 'text-sky-300',
    movement: 'text-emerald-300',
    reflection: 'text-violet-300',
  };

  const isMissed = isPast && !block.completed;

  return (
    <button
      onClick={onCheckIn}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        block.completed
          ? 'bg-emerald-950/15 border-emerald-800/30'
          : isCurrent
          ? 'bg-amber-950/15 border-amber-700/40'
          : isMissed
          ? 'bg-red-950/10 border-red-900/30 opacity-70'
          : 'bg-[#121212] border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {block.completed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" strokeWidth={2.2} />
          ) : isMissed ? (
            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" strokeWidth={2.2} />
          ) : (
            <Circle className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
          )}
          <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${typeColor[block.block_type] || 'text-neutral-500'}`}>
            {block.block_type}
          </span>
          {isCurrent && !block.completed && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">
              Live
            </span>
          )}
          {isNext && !block.completed && !isCurrent && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
              Next
            </span>
          )}
          {isMissed && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded">
              Missed
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-neutral-500 shrink-0">{block.start} — {block.end}</span>
      </div>
      <h3 className={`text-sm font-bold ${block.completed ? 'text-emerald-100' : isMissed ? 'text-red-200/80' : 'text-white'}`}>
        {block.label}
        {justChecked && <span className="ml-2 text-emerald-300 text-xs">✓ Saved</span>}
        {isMissed && !justChecked && <span className="ml-2 text-red-300/70 text-xs font-normal">· Tap to check in late</span>}
      </h3>
    </button>
  );
}
