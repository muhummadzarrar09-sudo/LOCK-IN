import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/security';

const DEFAULT_TEMPLATE = [
  { label: 'Deep Work Block 1', block_type: 'work', start_time: '06:00', end_time: '09:00', day: 1 },
  { label: 'Protected Break', block_type: 'break', start_time: '09:00', end_time: '09:30', day: 1 },
  { label: 'Deep Work Block 2', block_type: 'work', start_time: '09:30', end_time: '12:00', day: 1 },
  { label: 'Movement', block_type: 'movement', start_time: '12:00', end_time: '12:30', day: 1 },
  { label: 'Reflection / Journal', block_type: 'reflection', start_time: '12:30', end_time: '13:00', day: 1 },
  { label: 'Deep Work Block 3', block_type: 'work', start_time: '13:00', end_time: '16:00', day: 1 },
];

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    await rateLimit(request, { key: 'time-blocks', limit: 60, windowMs: 60_000, userId: actor.id });
    const admin = createSupabaseAdminClient();

    let { data: blocks, error } = await admin
      .from('time_blocks')
      .select('*')
      .eq('user_id', actor.id)
      .order('start_time', { ascending: true });
    if (error) throw error;

    if (!blocks || blocks.length === 0) {
      const toInsert = DEFAULT_TEMPLATE.map((block) => ({ ...block, user_id: actor.id }));
      const inserted = await admin
        .from('time_blocks')
        .insert(toInsert)
        .select('*')
        .order('start_time', { ascending: true });
      if (inserted.error) throw inserted.error;
      blocks = inserted.data || [];
    }

    const blockIds = (blocks || []).map((block: any) => block.id);
    let checkIns: any[] = [];
    if (blockIds.length > 0) {
      const checkInsRes = await admin
        .from('check_ins')
        .select('time_block_id')
        .eq('user_id', actor.id)
        .in('time_block_id', blockIds);
      if (checkInsRes.error) throw checkInsRes.error;
      checkIns = checkInsRes.data || [];
    }

    return NextResponse.json({ blocks: blocks || [], checkIns });
  } catch (error) {
    return jsonError(error);
  }
}
