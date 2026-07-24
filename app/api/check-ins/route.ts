import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { badRequest, jsonError } from '@/lib/api-errors';
import { enforceApiSecurity } from '@/lib/security';

const EARLY_GRACE_MINUTES = 10;
const LATE_GRACE_MINUTES = 30;

function parseTimeToMinutes(value: string) {
  const [hhRaw, mmRaw] = value.slice(0, 5).split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function currentMinutesInTimezone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0') % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    return hour * 60 + minute;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    await enforceApiSecurity(request, { key: 'check-ins', limit: 120, windowMs: 60_000, userId: actor.id });
    const body = await request.json().catch(() => null);
    const timeBlockId = typeof body?.timeBlockId === 'string' ? body.timeBlockId : '';
    const completed = body?.completed === true;

    if (!timeBlockId) return badRequest('Missing timeBlockId');

    const admin = createSupabaseAdminClient();
    const [{ data: block, error: blockError }, { data: profile }] = await Promise.all([
      admin
        .from('time_blocks')
        .select('id, user_id, start_time, end_time')
        .eq('id', timeBlockId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('timezone')
        .eq('id', actor.id)
        .maybeSingle(),
    ]);

    if (blockError) throw blockError;
    if (!block || (block as any).user_id !== actor.id) {
      return NextResponse.json({ error: 'Time block not found' }, { status: 404 });
    }

    if (!completed) {
      const { error } = await admin
        .from('check_ins')
        .delete()
        .eq('user_id', actor.id)
        .eq('time_block_id', timeBlockId);
      if (error) throw error;
      return NextResponse.json({ ok: true, completed: false });
    }

    const start = parseTimeToMinutes((block as any).start_time || '');
    const end = parseTimeToMinutes((block as any).end_time || '');
    if (start === null || end === null) return badRequest('Invalid time block window');

    const timezone = (profile as any)?.timezone || 'UTC';
    const nowMinutes = currentMinutesInTimezone(timezone);
    const opensAt = start - EARLY_GRACE_MINUTES;
    const closesAt = end + LATE_GRACE_MINUTES;

    if (nowMinutes < opensAt) {
      return NextResponse.json({ error: 'Check-in window has not opened yet' }, { status: 409 });
    }
    if (nowMinutes > closesAt) {
      return NextResponse.json({ error: 'Check-in window has closed' }, { status: 409 });
    }

    const { error } = await admin.from('check_ins').upsert({
      user_id: actor.id,
      time_block_id: timeBlockId,
      completed_at: new Date().toISOString(),
      missed: false,
    }, { onConflict: 'user_id,time_block_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true, completed: true });
  } catch (error) {
    return jsonError(error);
  }
}
