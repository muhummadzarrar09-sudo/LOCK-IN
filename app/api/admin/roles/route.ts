import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

const ALLOWED_ROLES = new Set(['admin', 'member']);

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiSecurity(request, { key: 'admin:roles', limit: 20, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === 'string' ? body.userId : '';
    const role = typeof body?.role === 'string' ? body.role : '';

    if (!userId) return badRequest('Missing userId');
    if (!ALLOWED_ROLES.has(role)) return badRequest('Invalid role');

    const admin = createSupabaseAdminClient();

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role, username, email')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if ((target as any).role === 'admin' && role === 'member') {
      const { count, error: countError } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 409 });
      }
    }

    const { error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    if (error) throw error;

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'admin.role.update',
      targetTable: 'profiles',
      targetId: userId,
      metadata: { previousRole: (target as any).role, newRole: role },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
