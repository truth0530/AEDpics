import { NextRequest, NextResponse } from 'next/server';

/**
 * DISABLED: Legacy Supabase endpoint
 * This endpoint was used for Supabase Service Role signup
 * Replaced by /api/auth/signup using NextAuth + Prisma
 */

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint has been disabled. Please use /api/auth/signup instead.' },
    { status: 501 }
  );
}
