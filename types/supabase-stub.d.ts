// Temporary type stubs for Supabase during migration to NCP
// These types prevent TypeScript errors while Supabase is being removed
// TODO: Remove this file once all Supabase dependencies are eliminated

declare module '@supabase/supabase-js' {
  export interface SupabaseClient<Database = any, SchemaName = any> {
    auth: any;
    from: (table: string) => any;
    rpc: (fn: string, params?: any) => any;
    channel: (name: string, options?: any) => any;
  }

  export function createClient<Database = any, SchemaName = any>(
    url: string,
    key: string,
    options?: any
  ): SupabaseClient<Database, SchemaName>;

  export type RealtimeChannel = any;
  export type RealtimePostgresChangesPayload<T = any> = any;
  export type RealtimePresenceState<T = any> = any;
  export type PostgrestError = any;
  export type User = any;
  export type Session = any;
  export type AuthError = any;
  export type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';
}

declare module '@supabase/ssr' {
  export function createServerClient(url: string, key: string, options: any): any;
  export function createBrowserClient(url: string, key: string, options?: any): any;
}