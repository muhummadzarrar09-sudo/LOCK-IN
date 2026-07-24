import 'server-only';
import { createClientServer } from '@/lib/supabase-server';

export class AuthzError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export type AuthzUser = {
  id: string;
  email: string | null;
  role: string | null;
};

export async function requireUser(): Promise<AuthzUser> {
  const supabase = await createClientServer();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthzError(401, 'Authentication required');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile as { role?: string } | null)?.role ?? null,
  };
}

export async function requireAdmin(): Promise<AuthzUser> {
  const user = await requireUser();

  if (user.role !== 'admin') {
    throw new AuthzError(403, 'Admin access required');
  }

  return user;
}

export function assertSameUser(actor: AuthzUser, targetUserId: string) {
  if (actor.id !== targetUserId) {
    throw new AuthzError(403, 'You can only access your own account');
  }
}
