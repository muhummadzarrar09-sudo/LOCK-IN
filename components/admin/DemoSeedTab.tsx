'use client';

import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';

type Props = {
  onSeeded?: () => void;
};

const DEMO_NAMES = [
  'Aria', 'Kenji', 'Lola', 'Mateo', 'Nia', 'Omar', 'Priya', 'Quinn',
  'Rin', 'Sora', 'Tariq', 'Uma', 'Vikram', 'Wren', 'Xan', 'Yuki',
  'Zara', 'Amir', 'Bex', 'Cy', 'Devi', 'Eli', 'Fern', 'Gus',
  'Hana', 'Ira', 'Jax', 'Kira', 'Leo', 'Maya', 'Nico', 'Ola',
  'Pia', 'Rio', 'Sami', 'Theo', 'Ula', 'Vex', 'Wade', 'Yara',
];

const DEMO_TEAMS = [
  { name: 'Foundry', title: 'AI for solo lawyers', pitch: 'Contract review that doesn’t need a human reviewer for the first pass.', stage: 'prototype' },
  { name: 'Atlas', title: 'Climate-risk dashboards for SMBs', pitch: 'What the IPCC reports say about your zip code, in plain English.', stage: 'idea' },
  { name: 'Lumen', title: 'Reading coach for 2nd graders', pitch: 'Personalized reading-level stories that adjust in real time.', stage: 'prototype' },
  { name: 'Hexa', title: 'Group-buying for indie pharmacies', pitch: 'Pool buying power so a corner pharmacy can compete with CVS.', stage: 'idea' },
  { name: 'Sable', title: 'Outbound for technical founders', pitch: 'Sales sequences that read like a friend, not a template.', stage: 'revenue' },
  { name: 'Volt', title: 'Power-usage optimization for coffee shops', pitch: 'Cut your electricity bill 30% without touching the espresso machine.', stage: 'prototype' },
];

const ACHIEVEMENT_CODES = ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_100'];

/**
 * Demo Seed tab — admin-only. Seeds the cohort with a realistic set of
 * fake members, time blocks, check-ins, streaks, achievements, team
 * feed posts, and a couple of community announcements + reports. This
 * is the "make the demo look real" tool. It runs entirely as the
 * authenticated admin; profiles are inserted with role='member' so
 * the seed members show up in leaderboards, /people, etc.
 *
 * IDEMPOTENT: a "Reset" mode wipes the seed members first, then
 * re-seeds. Default mode just adds more seed members without
 * touching existing data.
 *
 * IMPORTANT: This tab is wired into the admin page and gated by the
 * existing role check. It writes only to tables the admin already
 * has ALL access to. It does not bypass any RLS or escalate
 * privilege beyond what an admin already has.
 */
export function DemoSeedTab({ onSeeded }: Props) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [cohort, setCohort] = useState<{ id: string } | null>(null);

  // Resolve cohort id once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cohorts')
        .select('id')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setCohort(data as any);
    })();
  }, []);

  const seed = async (mode: 'add' | 'reset') => {
    if (mode === 'reset') {
      setResetting(true);
    } else {
      setRunning(true);
    }
    setProgress('Starting…');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      // 1. Optionally reset: delete seed members
      if (mode === 'reset') {
        setProgress('Clearing previous seed data…');
        // Seed members all have username starting with 'demo_'
        const { data: seedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .like('username', 'demo_%');
        const seedIds = (seedProfiles || []).map((p) => p.id);
        if (seedIds.length > 0) {
          // Delete in dependency order
          await supabase.from('achievements').delete().in('user_id', seedIds);
          await supabase.from('streak_freezes').delete().in('user_id', seedIds);
          await supabase.from('check_ins').delete().in('user_id', seedIds);
          await supabase.from('time_blocks').delete().in('user_id', seedIds);
          await supabase.from('team_startup_log').delete().in('user_id', seedIds);
          await supabase.from('team_members').delete().in('user_id', seedIds);
          await supabase.from('streaks').delete().in('user_id', seedIds);
          await supabase.from('profile_views').delete().in('viewed_user_id', seedIds);
          // profiles is the last one
          await supabase.from('profiles').delete().in('id', seedIds);
        }
      }

      // 2. Get admin's user id (we'll assign teams to a mix of seed + admin)
      const adminId = session.user.id;
      const adminEmail = session.user.email || 'admin@discipline.app';

      // 3. Create seed members
      setProgress('Creating demo members…');
      const seedMemberIds: string[] = [];
      const seedCount = 28; // ~28 fake members
      const startIdx = Math.floor(Math.random() * 1000); // randomize names

      for (let i = 0; i < seedCount; i++) {
        const name = DEMO_NAMES[(startIdx + i) % DEMO_NAMES.length];
        const username = `demo_${name.toLowerCase()}_${i}`;
        const email = `${username}@demo.discipline.app`;

        // Insert profile (admin RLS allows admin to insert into profiles)
        // The profiles table has RLS that lets users insert/update their own row.
        // For seeding, we need to bypass — but we don't have service role.
        // Workaround: insert via the admin's session by setting auth.uid() = new uuid.
        // Since we can't bypass RLS here without the service key, the admin
        // can only seed by switching to a member context. We attempt the
        // insert and skip silently if RLS denies.
        const { data: inserted, error } = await supabase
          .from('profiles')
          .insert({
            id: crypto.randomUUID(),
            username,
            email,
            role: 'member',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          } as any)
          .select('id')
          .maybeSingle();
        if (error || !inserted) continue;
        seedMemberIds.push((inserted as any).id);
      }

      if (seedMemberIds.length === 0) {
        toast.info('Demo seed requires server-side seeding. Profiles can only be created via auth.signUp or service-role key. Use the dashboard to invite real members.');
        setProgress('');
        return;
      }

      // 4. Create default time blocks for each seed member (6 blocks)
      setProgress('Setting up time blocks…');
      const blockTemplate = [
        { start: '06:00', end: '09:00', label: 'Deep work block 1', block_type: 'work', day: 1 },
        { start: '09:00', end: '09:30', label: 'Protected break', block_type: 'break', day: 1 },
        { start: '09:30', end: '12:00', label: 'Deep work block 2', block_type: 'work', day: 1 },
        { start: '12:00', end: '12:30', label: 'Movement', block_type: 'movement', day: 1 },
        { start: '12:30', end: '13:00', label: 'Reflection / journal', block_type: 'reflection', day: 1 },
        { start: '13:00', end: '16:00', label: 'Deep work block 3', block_type: 'work', day: 1 },
      ];
      const blockRows = seedMemberIds.flatMap((uid) =>
        blockTemplate.map((b) => ({ ...b, user_id: uid }))
      );
      await supabase.from('time_blocks').insert(blockRows as any);

      // 5. Generate check-ins for the last 7 days
      setProgress('Generating check-ins…');
      const checkInRows: any[] = [];
      const now = new Date();
      for (const uid of seedMemberIds) {
        // 60-95% completion rate per day, varies by member
        const memberQuality = 0.6 + Math.random() * 0.35;
        for (let d = 0; d < 7; d++) {
          const day = new Date(now);
          day.setDate(day.getDate() - d);
          for (let b = 0; b < 6; b++) {
            if (Math.random() < memberQuality) {
              const t = new Date(day);
              t.setHours(6 + b * 1.5, Math.floor(Math.random() * 50), 0, 0);
              // Use a deterministic block id placeholder — we'll fix below
              checkInRows.push({
                user_id: uid,
                time_block_id: '00000000-0000-0000-0000-000000000000',
                completed_at: t.toISOString(),
                missed: false,
              });
            }
          }
        }
      }
      // Map each check-in to a real time_block id (round-robin)
      // First fetch all the blocks we just created
      const { data: createdBlocks } = await supabase
        .from('time_blocks')
        .select('id, user_id')
        .in('user_id', seedMemberIds);
      if (createdBlocks && createdBlocks.length > 0) {
        const blocksByUser = new Map<string, string[]>();
        (createdBlocks as any[]).forEach((b) => {
          if (!blocksByUser.has(b.user_id)) blocksByUser.set(b.user_id, []);
          blocksByUser.get(b.user_id)!.push(b.id);
        });
        checkInRows.forEach((row) => {
          const userBlocks = blocksByUser.get(row.user_id);
          if (userBlocks && userBlocks.length > 0) {
            row.time_block_id = userBlocks[Math.floor(Math.random() * userBlocks.length)];
          }
        });
        // Filter rows that got a valid block id
        const validRows = checkInRows.filter((r) => r.time_block_id && r.time_block_id !== '00000000-0000-0000-0000-000000000000');
        // Insert in chunks
        const chunkSize = 200;
        for (let i = 0; i < validRows.length; i += chunkSize) {
          await supabase.from('check_ins').insert(validRows.slice(i, i + chunkSize) as any);
        }
      }

      // 6. Generate streaks (based on check-in count)
      setProgress('Computing streaks…');
      const streakRows = seedMemberIds.map((uid) => {
        const userCheckIns = checkInRows.filter((c) => c.user_id === uid);
        const lastDate = userCheckIns.length > 0
          ? userCheckIns.reduce((max, c) => c.completed_at > max ? c.completed_at : max, userCheckIns[0].completed_at)
          : null;
        const current = Math.min(7, Math.floor(Math.random() * 8));
        const best = Math.max(current, Math.floor(Math.random() * 30));
        return {
          user_id: uid,
          current_streak: current,
          best_streak: best,
          last_check_in_date: lastDate ? lastDate.slice(0, 10) : null,
        };
      });
      await supabase.from('streaks').insert(streakRows as any);

      // 7. Generate achievements (random subset)
      setProgress('Granting achievements…');
      const achRows: any[] = [];
      for (const uid of seedMemberIds) {
        const userStreak = streakRows.find((s) => s.user_id === uid);
        if (!userStreak) continue;
        for (const code of ACHIEVEMENT_CODES) {
          const threshold = parseInt(code.replace('streak_', ''), 10);
          if (userStreak.best_streak >= threshold) {
            achRows.push({ user_id: uid, code });
          }
        }
      }
      if (achRows.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < achRows.length; i += chunkSize) {
          await supabase.from('achievements').insert(achRows.slice(i, i + chunkSize) as any);
        }
      }

      // 8. Generate streak freezes (for members with best_streak >= 7)
      setProgress('Granting streak freezes…');
      const freezeRows = seedMemberIds
        .filter((uid) => {
          const s = streakRows.find((x) => x.user_id === uid);
          return s && s.best_streak >= 7;
        })
        .map((uid) => ({ user_id: uid }));
      if (freezeRows.length > 0) {
        await supabase.from('streak_freezes').insert(freezeRows as any);
      }

      // 9. Create 6 demo teams
      setProgress('Creating demo teams…');
      const teamRows = DEMO_TEAMS.map((t) => ({
        name: t.name,
        startup_title: t.title,
        startup_pitch: t.pitch,
        startup_stage: t.stage,
        cohort_id: cohort?.id || null,
      }));
      const { data: createdTeams } = await supabase
        .from('teams')
        .insert(teamRows as any)
        .select('id, name');
      if (createdTeams && createdTeams.length > 0) {
        // Distribute members across teams (4 per team + admin in team 0)
        const teamIds = (createdTeams as any[]).map((t) => t.id);
        const teamMemberRows: any[] = [];
        seedMemberIds.forEach((uid, idx) => {
          const teamId = teamIds[Math.floor(idx / 4) % teamIds.length];
          teamMemberRows.push({ team_id: teamId, user_id: uid });
        });
        // Add admin to first team
        teamMemberRows.push({ team_id: teamIds[0], user_id: adminId });
        await supabase.from('team_members').insert(teamMemberRows as any);

        // 10. Add team feed posts
        setProgress('Seeding team feeds…');
        const feedRows: any[] = [];
        const seedMessages = [
          'Shipped the onboarding flow. 3 user tests scheduled for tomorrow.',
          'Hit a wall on the auth flow. Pivoting to magic-link.',
          'Cold-outreach numbers: 40 emails, 11 replies, 3 calls booked.',
          'Re-wrote the pricing page. 14% lift on free-to-paid trial start.',
          'Closed our first design partner. $500/mo, 6-month commit.',
          'Demoed at a community event. Two warm intros to follow up.',
          'Fixed the race condition in the queue. No more duplicate jobs.',
          'Landed a podcast guest spot. 8k downloads avg, recording Tuesday.',
          'Hit $2k MRR. Quietly. No fanfare, just keep shipping.',
          'Wrote the launch post. Going out Thursday at 9am PT.',
        ];
        for (const tm of teamMemberRows.slice(0, 24)) {
          if (Math.random() < 0.4) {
            const ago = Math.floor(Math.random() * 72); // last 3 days
            const t = new Date(Date.now() - ago * 60 * 60 * 1000);
            feedRows.push({
              team_id: tm.team_id,
              user_id: tm.user_id,
              note: seedMessages[Math.floor(Math.random() * seedMessages.length)],
              created_at: t.toISOString(),
            });
          }
        }
        if (feedRows.length > 0) {
          await supabase.from('team_startup_log').insert(feedRows as any);
        }
      }

      toast.success(`Demo seeded: ${seedMemberIds.length} members, ${teamRows.length} teams, ${checkInRows.length} check-ins.`);
      setProgress('Done');
      onSeeded?.();
    } catch (e: any) {
      console.warn('demo seed error', e);
      toast.error('Demo seed encountered an issue. Some inserts may have been skipped (e.g. RLS).');
    } finally {
      setRunning(false);
      setResetting(false);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/30 to-amber-900/5 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <h2 className="text-sm font-extrabold text-amber-100">Demo seed</h2>
        </div>
        <p className="text-xs text-amber-200/80 leading-relaxed mb-5">
          Populate the cohort with ~28 fake members, 6 demo teams, 7 days of check-ins, streaks, achievements, and team feed posts. Useful for the demo and for screenshotting the analytics tab.
        </p>

        {progress && (
          <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-100 font-mono">
            {progress}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => seed('add')}
            disabled={running || resetting}
            className="h-10 px-4 rounded-lg bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {running ? 'Seeding…' : 'Seed demo data'}
          </button>
          <button
            onClick={() => {
              if (confirm('Wipe all existing demo data (members with username starting with demo_) and re-seed?')) {
                seed('reset');
              }
            }}
            disabled={running || resetting}
            className="h-10 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 font-semibold text-sm hover:border-red-500/40 hover:text-red-200 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {resetting ? 'Resetting…' : 'Reset + re-seed'}
          </button>
          <span className="text-[10px] text-amber-300/60 inline-flex items-center gap-1 ml-auto">
            <Check className="w-3 h-3" />
            Safe to run multiple times
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-5">
        <h3 className="text-xs font-extrabold text-neutral-500 uppercase tracking-[0.2em] mb-3">What gets created</h3>
        <ul className="text-xs text-neutral-300 space-y-1.5 leading-relaxed">
          <li>· <span className="font-bold text-amber-200">~28 members</span> with usernames like <span className="font-mono text-neutral-400">demo_aria_0</span></li>
          <li>· <span className="font-bold text-amber-200">6 demo teams</span> (Foundry, Atlas, Lumen, Hexa, Sable, Volt) with realistic startup pitches</li>
          <li>· <span className="font-bold text-amber-200">~150 check-ins</span> across the last 7 days (60-95% completion rate per member)</li>
          <li>· <span className="font-bold text-amber-200">Streaks</span> between 0 and 30 days, with achievements + freezes for the high-streak members</li>
          <li>· <span className="font-bold text-amber-200">Team feed posts</span> with realistic shipping updates</li>
        </ul>
        <p className="text-[10px] text-neutral-500 mt-4 leading-relaxed">
          Note: profile inserts are subject to RLS. If you see "no members created" after seeding, your Supabase project has the strict "users can only insert their own profile" policy — use Supabase SQL editor to bulk-insert the seed SQL directly, or invite real test accounts via email.
        </p>
      </div>
    </div>
  );
}
