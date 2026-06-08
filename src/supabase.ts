import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const SUPABASE_URL = (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_SUPABASE_URL) || import.meta.env?.VITE_SUPABASE_URL || '';
// @ts-ignore
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY) || import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Robust URL check returning false on invalid/template URLs
export const isSupabaseConfigured = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (SUPABASE_URL.includes('votre') || SUPABASE_URL.includes('your-project') || SUPABASE_URL.includes('votre-projet')) return false;
    if (SUPABASE_ANON_KEY.includes('votre') || SUPABASE_ANON_KEY.includes('your-api-key') || SUPABASE_ANON_KEY === 'votre-cle-api') return false;
    if (!SUPABASE_ANON_KEY.startsWith('eyJ')) return false;
    return true;
  } catch (e) {
    return false;
  }
})();

// Create a safe mock client for absolute safety when not configured
const createMockSupabase = (): any => {
  const handler: ProxyHandler<any> = {
    get(target, prop): any {
      if (prop === 'auth') {
        return {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ data: { user: null }, error: null }),
          signUp: async () => ({ data: { user: null }, error: null }),
          signOut: async () => ({ error: null }),
          signInWithOAuth: async () => ({ data: { provider: '' }, error: null }),
        };
      }
      if (prop === 'from') {
        return () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
            limit: async () => ({ data: [], error: null }),
            then: (cb: any) => cb({ data: [], error: null }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
          upsert: () => Promise.resolve({ error: null }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
          insert: () => Promise.resolve({ error: null }),
        });
      }
      return createMockSupabase();
    }
  };
  return new Proxy(() => {}, handler);
};

// Create actual client if configured, otherwise create a mock proxy object to prevent undefined crashes
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createMockSupabase();

if (!isSupabaseConfigured) {
  console.warn(
    "[Supabase] No credentials found in environment variables. Falling back to robust local-only mode. Go to AI Studio Settings to add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for persistent cloud storage."
  );
}
