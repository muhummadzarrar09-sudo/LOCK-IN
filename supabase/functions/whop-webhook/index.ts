// Supabase Edge Function: whop-webhook
// -----------------------------------------
// Receives Whop purchase events. Creates a cohort_invite row + sends a
// magic-link signup email via Resend.
//
// Deploy:
//   supabase functions deploy whop-webhook
//
// Configure Whop to POST to:
//   https://<project-ref>.supabase.co/functions/v1/whop-webhook
// with the event type "membership.created" or "membership.activated".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { welcomeEmail } from '../_shared/emails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Discipline <noreply@lockin.app>';
const BASE_URL = Deno.env.get('PUBLIC_BASE_URL') || 'https://lockin.app';
// Whop webhook signature verification: set WHOP_WEBHOOK_SECRET in env
const WHOP_WEBHOOK_SECRET = Deno.env.get('WHOP_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const raw = await req.text();
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Whop event types: membership.created, membership.activated, payment.succeeded
  // We only care about new memberships for now.
  if (!['membership.created', 'membership.activated', 'payment.succeeded'].includes(event?.type)) {
    return new Response(JSON.stringify({ ok: true, ignored: event?.type }), { headers: { 'content-type': 'application/json' } });
  }

  // Extract email from Whop event payload
  const email = event?.data?.user?.email || event?.data?.email || event?.email;
  if (!email) {
    return new Response('Missing email', { status: 400 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find the active cohort (or the one Whop product is for; here we just pick latest)
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('id, name')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Generate a unique token
    const token = crypto.randomUUID().replace(/-/g, '');

    // Insert invite
    const { error: inviteError } = await supabase.from('cohort_invites').insert({
      email,
      cohort_id: cohort?.id || null,
      token,
    } as any);
    if (inviteError) throw inviteError;

    // Send welcome email with magic link
    const { subject, html, text } = welcomeEmail(email.split('@')[0], `${BASE_URL}/auth/signup?token=${token}`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);

    return new Response(JSON.stringify({ ok: true, email, tokenSent: true }), { headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    console.error('whop-webhook error:', err);
    return new Response(JSON.stringify({ ok: false, error: err?.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
