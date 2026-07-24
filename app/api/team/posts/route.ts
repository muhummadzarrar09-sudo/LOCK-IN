import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    await enforceApiSecurity(request, { key: 'team:posts', limit: 20, windowMs: 60_000, userId: actor.id, maxBytes: 16 * 1024 });
    const body = await request.json().catch(() => null);
    const teamId = typeof body?.teamId === 'string' ? body.teamId : '';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!teamId) return badRequest('Missing teamId');
    if (!note) return badRequest('Post body is required');
    if (note.length > 2000) return badRequest('Post is too long');

    const admin = createSupabaseAdminClient();
    const { data: membership, error: membershipError } = await admin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', actor.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });

    const { data, error } = await admin
      .from('team_startup_log')
      .insert({ team_id: teamId, user_id: actor.id, note })
      .select('id, team_id, user_id, note, created_at')
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ post: data });
  } catch (error) {
    return jsonError(error);
  }
}
