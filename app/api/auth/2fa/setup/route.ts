/**
 * 2FA Setup API
 *
 * POST /api/auth/2fa/setup
 * - Generate TOTP secret and QR code
 * - Return QR code image and backup codes
 *
 * NIS Certification: Two-Factor Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { generateTOTPSecret } from '@/lib/auth/totp';
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

    // Generate TOTP secret
    const setupResult = await generateTOTPSecret(payload.userId, payload.email);

    // Audit log
    await createAuditLog({
      userId: payload.userId,
      action: '2FA_SETUP_INITIATED',
      resource: 'User',
      resourceId: payload.userId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '2FA setup initiated. Please scan QR code with authenticator app.',
      data: {
        qrCodeUrl: setupResult.qrCodeUrl,
        secret: setupResult.secret,
        backupCodes: setupResult.backupCodes,
      },
    });
  } catch (error) {
    console.error('[2FA Setup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
