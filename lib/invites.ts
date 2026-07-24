/**
 * Invite / Whop magic-link helpers
 * -----------------------------------------
 * When a Whop customer purchases access, the webhook (Supabase Edge Function)
 * inserts a row into cohort_invites with a unique token. The buyer receives
 * an email with a link like /auth/signup?token=ABC. On signup, we check the
 * token, mark it consumed, and continue the normal auth flow.
 *
 * The auth code itself is NOT modified — this is a *pre-step* that ensures
 * the signup is for a legitimate cohort purchase.
 */

import { supabase } from './supabase';

export type Invite = {
  id: string;
  email: string;
  cohort_id: string | null;
  token: string;
  consumed_at: string | null;
  expires_at: string;
};

/** Look up a valid invite by token. Returns null if invalid/expired/consumed. */
export async function lookupInvite(token: string): Promise<Invite | null> {
  if (!token) return null;
  try {
    const { data, error } = await supabase
      .from('cohort_invites')
      .select('id, email, cohort_id, token, consumed_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (error || !data) return null;
    const invite = data as unknown as Invite;
    if (invite.consumed_at) return null;
    if (new Date(invite.expires_at).getTime() < Date.now()) return null;
    return invite;
  } catch {
    return null;
  }
}

/** Mark an invite as consumed by a specific user. */
export async function consumeInvite(token: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cohort_invites')
      .update({ consumed_at: new Date().toISOString(), consumed_by: userId } as any)
      .eq('token', token)
      .is('consumed_at', null);
    return !error;
  } catch {
    return false;
  }
}
