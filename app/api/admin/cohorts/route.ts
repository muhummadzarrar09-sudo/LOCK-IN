import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiSecurity(request, { key: 'admin:cohorts', limit: 30, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const startDate = typeof body?.start_date === 'string' ? body.start_date : '';
    const endDate = typeof body?.end_date === 'string' ? body.end_date : '';
    const enrollmentOpen = typeof body?.enrollment_open === 'boolean' ? body.enrollment_open : true;

    if (!name) return badRequest('Cohort name is required');
    if (!isDate(startDate) || !isDate(endDate)) return badRequest('Valid start_date and end_date are required');
    if (startDate > endDate) return badRequest('start_date must be before end_date');

    const admin = createSupabaseAdminClient();
    const payload = {
      name,
      start_date: startDate,
      end_date: endDate,
      enrollment_open: enrollmentOpen,
    };

    if (id) {
      const { data, error } = await admin
        .from('cohorts')
        .update(payload)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });

      await writeAuditLog(admin, {
        actorUserId: actor.id,
        action: 'admin.cohort.update',
        targetTable: 'cohorts',
        targetId: id,
        metadata: payload,
      });

      return NextResponse.json({ cohort: data });
    }

    const { data, error } = await admin
      .from('cohorts')
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'admin.cohort.create',
      targetTable: 'cohorts',
      targetId: (data as any)?.id,
      metadata: payload,
    });

    return NextResponse.json({ cohort: data });
  } catch (error) {
    return jsonError(error);
  }
}
