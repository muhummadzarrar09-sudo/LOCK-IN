// Supabase Edge Function: send-digest
// -----------------------------------------
// Run on a schedule (via pg_cron or Supabase Scheduled Functions).
// Pulls active cohort members, computes their stats, and emails a weekly digest.
//
// Deploy:
//   supabase functions deploy send-digest
// Schedule (in Supabase Dashboard → Edge Functions → Schedules):
//   cron: "0 18 * * 0"  (Sundays at 18:00 UTC)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { weeklyDigest } from '../_shared/emails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Discipline <noreply@lockin.app>';
const BASE_URL = Deno.env.get('PUBLIC_BASE_URL') || 'https://lockin.app';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find the active cohort
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('id, name, start_date, end_date')
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cohort) {
      return new Response(JSON.stringify({ ok: true, message: 'No active cohort' }), { headers: { 'content-type': 'application/json' } });
    }

    // Find all members
    const { data: members } = await supabase
      .from('profiles')
      .select('id, username, email, role')
      .eq('role', 'member');
    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No members' }), { headers: { 'content-type': 'application/json' } });
    }

    // Get all streaks
    const { data: streaks } = await supabase
      .from('streaks')
      .select('user_id, current_streak, best_streak');

    const streakMap = new Map((streaks || []).map((s: any) => [s.user_id, s]));

    // Compute cohort day
    const start = new Date(cohort.start_date);
    const today = new Date();
    const cohortDay = Math.min(30, Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1));

    // Sort by streak desc, assign rank
    const sorted = [...members]
      .map((m) => ({
        id: m.id,
        email: m.email,
        username: m.username,
        streak: streakMap.get(m.id)?.current_streak || 0,
        bestStreak: streakMap.get(m.id)?.best_streak || 0,
      }))
      .sort((a, b) => b.streak - a.streak || a.username.localeCompare(b.username));
    const ranked = sorted.map((m, i) => ({ ...m, rank: i + 1 }));

    // Send digest to each member
    const results = await Promise.allSettled(
      ranked.map(async (m) => {
        const { subject, html, text } = weeklyDigest(m.username, {
          streak: m.streak,
          bestStreak: m.bestStreak,
          rank: m.rank,
          totalMembers: ranked.length,
          cohortDay,
        });
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [m.email],
            subject,
            html,
            text,
          }),
        });
        if (!res.ok) throw new Error(`Resend error for ${m.email}: ${await res.text()}`);
        return m.email;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return new Response(
      JSON.stringify({ ok: true, cohort: cohort.name, sent, failed, total: ranked.length }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Unknown error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
});
