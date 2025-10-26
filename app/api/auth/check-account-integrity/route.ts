import { NextRequest, NextResponse } from 'next/server';

/**
 * DISABLED: Legacy Supabase endpoint
 * This endpoint was used for Supabase Auth.users sync validation
 * No longer needed with NextAuth + Prisma architecture
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint has been disabled. Supabase migration complete.' },
    { status: 501 }
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint has been disabled. Supabase migration complete.' },
    { status: 501 }
  );
}
