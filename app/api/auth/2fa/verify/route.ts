/**
 * 2FA Verify API
 *
 * POST /api/auth/2fa/verify
 * - Verify TOTP token and enable 2FA
 *
 * NIS Certification: Two-Factor Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { verifyAndEnableTOTP } from '@/lib/auth/totp';
import { createAuditLog } from '@/lib/db/prisma';
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

    // Get TOTP token from request body
    const body = await request.json();
    const { token: totpToken } = body;

    if (!totpToken) {
      return NextResponse.json(
        { error: 'TOTP token is required' },
        { status: 400 }
      );
    }

    // Verify and enable TOTP
    const verified = await verifyAndEnableTOTP(payload.userId, totpToken);

    if (!verified) {
      // Audit log for failed verification
      await createAuditLog({
        userId: payload.userId,
        action: '2FA_VERIFICATION_FAILED',
        resource: 'User',
        resourceId: payload.userId,
        changes: { token: totpToken },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        { error: 'Invalid TOTP token' },
        { status: 400 }
      );
    }

    // Audit log for successful 2FA enablement
    await createAuditLog({
      userId: payload.userId,
      action: '2FA_ENABLED',
      resource: 'User',
      resourceId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully enabled',
    });
  } catch (error) {
    console.error('[2FA Verify] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
