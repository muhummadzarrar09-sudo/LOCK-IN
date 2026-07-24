import 'server-only';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export class SecurityError extends Error {
  status: number;
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = 'SecurityError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const DEFAULT_JSON_BODY_LIMIT = 64 * 1024;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';
}

export function assertSameOrigin(request: Request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) {
    throw new SecurityError(403, 'Missing origin');
  }

  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new SecurityError(403, 'Invalid origin');
  }

  if (originHost !== host) {
    throw new SecurityError(403, 'Cross-origin request rejected');
  }
}

export function assertJsonRequest(request: Request, maxBytes = DEFAULT_JSON_BODY_LIMIT) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new SecurityError(415, 'Expected application/json');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > maxBytes) {
      throw new SecurityError(413, 'Request body too large');
    }
  }
}

function memoryRateLimit(bucketKey: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new SecurityError(429, `Too many requests. Try again in ${retryAfter}s`, retryAfter);
  }
}

async function durableRateLimit(bucketKey: string, limit: number, windowMs: number) {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (result && result.allowed === false) {
      const retryAfter = Number(result.retry_after || 60);
      throw new SecurityError(429, `Too many requests. Try again in ${retryAfter}s`, retryAfter);
    }
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    // If the SQL migration has not been applied or the database is temporarily
    // unavailable, fall back to process-local limiting rather than failing open.
    memoryRateLimit(bucketKey, limit, windowMs);
  }
}

export async function rateLimit(
  request: Request,
  options: { key: string; limit: number; windowMs: number; userId?: string | null },
) {
  const principal = options.userId || clientIp(request);
  const bucketKey = `${options.key}:${principal}`;
  await durableRateLimit(bucketKey, options.limit, options.windowMs);
}

export function securityJsonError(error: unknown) {
  if (error instanceof SecurityError) {
    const headers = error.status === 429 ? { 'Retry-After': String(error.retryAfter ?? 60) } : undefined;
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  return null;
}

export async function enforceApiSecurity(
  request: Request,
  options: { key: string; limit?: number; windowMs?: number; userId?: string | null; maxBytes?: number },
) {
  assertSameOrigin(request);
  assertJsonRequest(request, options.maxBytes);
  await rateLimit(request, {
    key: options.key,
    limit: options.limit ?? 60,
    windowMs: options.windowMs ?? 60_000,
    userId: options.userId,
  });
}
