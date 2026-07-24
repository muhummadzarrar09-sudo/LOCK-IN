import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity, rateLimit } from '@/lib/security';

const STATUSES = new Set(['open', 'triaged', 'resolved', 'closed']);

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin();
    await rateLimit(request, { key: 'admin:bug-reports:get', limit: 60, windowMs: 60_000, userId: actor.id });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ bugReports: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiSecurity(request, { key: 'admin:bug-reports', limit: 60, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id : '';
    const status = typeof body?.status === 'string' ? body.status : undefined;
    const adminNotes = typeof body?.admin_notes === 'string' ? body.admin_notes : undefined;

    if (!id) return badRequest('Missing bug report id');

    const patch: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!STATUSES.has(status)) return badRequest('Invalid status');
      patch.status = status;
      patch.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    }
    if (adminNotes !== undefined) {
      if (adminNotes.length > 10000) return badRequest('Admin notes are too long');
      patch.admin_notes = adminNotes;
    }
    if (Object.keys(patch).length === 0) return badRequest('No allowed fields to update');

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('bug_reports').update(patch).eq('id', id);
    if (error) throw error;

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'admin.bug_report.update',
      targetTable: 'bug_reports',
      targetId: id,
      metadata: patch,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
