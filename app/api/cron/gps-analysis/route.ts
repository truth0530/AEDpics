import { NextResponse } from 'next/server';

/**
 * DISABLED: GPS Analysis Cron Job
 *
 * This cron job has Decimal type handling issues that need to be fixed.
 * Decimal values from Prisma need to be converted to numbers using .toNumber() method.
 *
 * TODO: Fix Decimal type conversions and re-enable
 */

export async function GET(request: Request) {
  // Vercel Cron Job 인증 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      message: 'GPS Analysis cron job is currently disabled. Decimal type handling needs to be fixed.',
      status: 'not_implemented'
    },
    { status: 501 }
  );
}
