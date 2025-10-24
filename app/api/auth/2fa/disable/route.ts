/**
 * 2FA Disable API
 *
 * POST /api/auth/2fa/disable
 * - Disable 2FA for user
 * - Requires password confirmation
 *
 * NIS Certification: Two-Factor Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { disableTOTP } from '@/lib/auth/totp';
import { createAuditLog } from '@/lib/db/prisma';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';
import { getIdentifier, createRateLimitResponse } from '@/lib/middleware/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.auth);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Authentication
    const token = request.cookies.get('auth-token')?.value ||
                  request.headers.get('authorization')?.slice(7);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get password confirmation
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to disable 2FA' },
        { status: 400 }
      );
    }

    // Verify password
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Disable TOTP
    await disableTOTP(payload.userId);

    // Audit log
    await createAuditLog({
      userId: payload.userId,
      action: '2FA_DISABLED',
      resource: 'User',
      resourceId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully disabled',
    });
  } catch (error) {
    console.error('[2FA Disable] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
