import { NextResponse } from 'next/server';

/**
 * DISABLED: Health Centers Sync API
 *
 * This feature requires Supabase RPC function 'find_health_center_id' which is not available in NCP.
 * Needs to be reimplemented using Prisma and PostgreSQL functions.
 *
 * TODO: Reimplement using Prisma and NCP PostgreSQL
 */

export async function POST(request: Request) {
  return NextResponse.json(
    {
      error: 'Health centers sync feature is currently disabled. Supabase RPC not available.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Health centers sync feature is currently disabled. Supabase RPC not available.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}
