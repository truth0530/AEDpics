import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { env } from '@/lib/env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Deprecated: Supabase check (kept for backward compatibility)
export const hasEnvVars =
  env.NEXT_PUBLIC_SUPABASE_URL &&
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
