import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiSecurity(request, { key: 'admin:reports', limit: 20, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const reportBody = typeof body?.body === 'string' ? body.body.trim() : '';

    if (!title) return badRequest('Title is required');
    if (!reportBody) return badRequest('Body is required');
    if (title.length > 200) return badRequest('Title is too long');
    if (reportBody.length > 50000) return badRequest('Body is too long');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('reports')
      .insert({ title, body: reportBody, author_id: actor.id })
      .select('id')
      .maybeSingle();
    if (error) throw error;

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'admin.report.create',
      targetTable: 'reports',
      targetId: (data as any)?.id,
      metadata: { title },
    });

    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (error) {
    return jsonError(error);
  }
}
