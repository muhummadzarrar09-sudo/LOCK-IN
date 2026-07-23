import { createBrowserClient } from '@supabase/ssr';

// Use placeholder values during build if env not set, so static prerender doesn't crash
// Real env will be injected at runtime on Vercel
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('[supabase] Missing env, using placeholder for build');
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createClient();
