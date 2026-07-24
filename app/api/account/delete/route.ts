import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

async function ignoreMissingTable(promise: PromiseLike<{ error: any }>) {
  const { error } = await promise;
  if (error && error.code !== '42P01' && error.code !== 'PGRST204') throw error;
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    await enforceApiSecurity(request, { key: 'account:delete', limit: 5, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const confirmationEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const actorEmail = (actor.email || '').trim().toLowerCase();

    if (!actorEmail) return badRequest('Current account email is unavailable');
    if (confirmationEmail !== actorEmail) return badRequest('Confirmation email does not match');

    const admin = createSupabaseAdminClient();

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'account.delete.requested',
      targetTable: 'auth.users',
      targetId: actor.id,
      metadata: { email: actor.email },
    });

    // Children / owned rows first. Service role bypasses RLS and makes this
    // deterministic instead of best-effort client deletes.
    await ignoreMissingTable(admin.from('profile_views').delete().eq('viewed_user_id', actor.id));
    await ignoreMissingTable(admin.from('profile_views').delete().eq('viewer_user_id', actor.id));
    await ignoreMissingTable(admin.from('achievements').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('streak_freezes').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('check_ins').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('time_blocks').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('streaks').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('team_startup_log').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('team_members').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('reminders').delete().eq('user_id', actor.id));
    await ignoreMissingTable(admin.from('device_sessions').delete().eq('user_id', actor.id));

    // Preserve support history but remove direct identity.
    await ignoreMissingTable(admin.from('bug_reports').update({ user_id: null, user_email: 'deleted user' }).eq('user_id', actor.id));

    await ignoreMissingTable(admin.from('profiles').delete().eq('id', actor.id));

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(actor.id);
    if (deleteUserError) throw deleteUserError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
