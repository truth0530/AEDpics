/**
 * Debug API - Check which database is being used
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    project_id: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('aieltmidsagiobpuebvv')
      ? 'aieltmidsagiobpuebvv (NEW)'
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('aieltmidsagiobpuebvv')
      ? 'aieltmidsagiobpuebvv (OLD)'
      : 'UNKNOWN',
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 50) + '...'
  });
}
