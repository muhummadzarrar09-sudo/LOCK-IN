import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    await enforceApiSecurity(request, { key: 'profile-views', limit: 30, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const viewedUserId = typeof body?.viewedUserId === 'string' ? body.viewedUserId : '';

    if (!viewedUserId) return badRequest('Missing viewedUserId');
    if (viewedUserId === actor.id) return NextResponse.json({ ok: true, skipped: true });

    const admin = createSupabaseAdminClient();

    // Coalesce spammy repeated views from the same viewer/profile pair.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from('profile_views')
      .select('*', { count: 'exact', head: true })
      .eq('viewed_user_id', viewedUserId)
      .eq('viewer_user_id', actor.id)
      .gte('viewed_at', since);
    if (countError) throw countError;
    if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: true });

    const { error } = await admin.from('profile_views').insert({
      viewed_user_id: viewedUserId,
      viewer_user_id: actor.id,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
