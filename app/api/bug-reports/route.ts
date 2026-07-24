import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    await enforceApiSecurity(request, { key: 'bug-reports', limit: 10, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const text = typeof body?.body === 'string' ? body.body.trim() : '';
    const url = typeof body?.url === 'string' ? body.url.slice(0, 2000) : null;
    const userAgent = typeof body?.user_agent === 'string' ? body.user_agent.slice(0, 1000) : null;

    if (!text) return badRequest('Report body is required');
    if (text.length > 5000) return badRequest('Report body is too long');

    const admin = createSupabaseAdminClient();

    // Simple DB-backed throttle: max 5 bug reports per rolling hour.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', actor.id)
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: 'Too many reports. Please try again later.' }, { status: 429 });
    }

    const { error } = await admin.from('bug_reports').insert({
      user_id: actor.id,
      user_email: actor.email,
      body: text,
      url,
      user_agent: userAgent,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
