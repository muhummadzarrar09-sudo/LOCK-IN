import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

const ALLOWED_STAGES = new Set(['idea', 'prototype', 'revenue']);

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    await enforceApiSecurity(request, { key: 'admin:teams', limit: 30, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const startupTitle = typeof body?.startup_title === 'string' ? body.startup_title.trim() : '';
    const startupPitch = typeof body?.startup_pitch === 'string' ? body.startup_pitch.trim() : '';
    const startupStage = typeof body?.startup_stage === 'string' && ALLOWED_STAGES.has(body.startup_stage)
      ? body.startup_stage
      : 'idea';
    const cohortId = typeof body?.cohort_id === 'string' && body.cohort_id.trim() ? body.cohort_id.trim() : null;

    if (!name) return badRequest('Team name is required');
    if (name.length > 120) return badRequest('Team name is too long');

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('teams')
      .insert({
        name,
        startup_title: startupTitle || null,
        startup_pitch: startupPitch || null,
        startup_stage: startupStage,
        cohort_id: cohortId,
      })
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await writeAuditLog(admin, {
      actorUserId: actor.id,
      action: 'admin.team.create',
      targetTable: 'teams',
      targetId: (data as any)?.id,
      metadata: { name, cohortId },
    });

    return NextResponse.json({ team: data });
  } catch (error) {
    return jsonError(error);
  }
}
