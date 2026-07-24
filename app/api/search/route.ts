import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { jsonError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/security';
import { safeIlikePattern, safeSearchTerm } from '@/lib/search';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    await rateLimit(request, { key: 'search', limit: 30, windowMs: 60_000, userId: actor.id });

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    const q = safeSearchTerm(url.searchParams.get('q') || '', 80);
    const page = Math.max(0, Math.min(50, Number(url.searchParams.get('page') || '0') || 0));
    const limit = Math.max(1, Math.min(PAGE_SIZE, Number(url.searchParams.get('limit') || '10') || 10));
    const from = page * limit;
    const to = from + limit - 1;

    if (q.length < 2) {
      return NextResponse.json({ members: [], reports: [], community: [] });
    }

    const like = safeIlikePattern(q);
    const supabase = createSupabaseAdminClient();

    const includeMembers = type === 'all' || type === 'members';
    const includeReports = type === 'all' || type === 'reports';
    const includeCommunity = type === 'all' || type === 'community';

    const [membersRes, reportsRes, communityRes] = await Promise.all([
      includeMembers
        ? supabase
            .from('profiles')
            .select('id, username')
            .eq('role', 'member')
            .ilike('username', like)
            .order('username')
            .range(from, to)
        : Promise.resolve({ data: [], error: null }),
      includeReports
        ? supabase
            .from('reports')
            .select('id, title, body, created_at')
            .or(`title.ilike.${like},body.ilike.${like}`)
            .order('created_at', { ascending: false })
            .range(from, to)
        : Promise.resolve({ data: [], error: null }),
      includeCommunity
        ? supabase
            .from('community_posts')
            .select('id, title, body, created_at')
            .or(`title.ilike.${like},body.ilike.${like}`)
            .order('created_at', { ascending: false })
            .range(from, to)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (reportsRes.error) throw reportsRes.error;
    if (communityRes.error) throw communityRes.error;

    return NextResponse.json({
      members: membersRes.data || [],
      reports: (reportsRes.data || []).map((r: any) => ({ ...r, body: typeof r.body === 'string' ? r.body.slice(0, 500) : '' })),
      community: (communityRes.data || []).map((p: any) => ({ ...p, body: typeof p.body === 'string' ? p.body.slice(0, 500) : '' })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
