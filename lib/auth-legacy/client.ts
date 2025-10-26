import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client
 * This client is used in Client Components
 */
export function createClient() {
  // 환경변수에서 공백과 개행문자 제거
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    console.error('Missing Supabase environment variables:', {
      url: !!url,
      anonKey: !!anonKey
    });
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient(url, anonKey, {
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
