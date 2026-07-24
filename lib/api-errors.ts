import 'server-only';
import { NextResponse } from 'next/server';
import { AuthzError } from '@/lib/authz';
import { securityJsonError } from '@/lib/security';

export function jsonError(error: unknown) {
  const securityError = securityJsonError(error);
  if (securityError) return securityError;

  if (error instanceof AuthzError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error('[api]', error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
