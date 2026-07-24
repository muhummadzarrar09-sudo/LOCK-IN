import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeAuditLog(
  adminClient: SupabaseClient,
  input: {
    actorUserId: string;
    action: string;
    targetTable?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await adminClient.from('audit_logs').insert({
      actor_user_id: input.actorUserId,
      action: input.action,
      target_table: input.targetTable ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.warn('[audit] failed to write audit log', error);
  }
}
