import { NextRequest, NextResponse } from 'next/server';
import { isAllowedEmailDomain } from '@/lib/auth/config';
import { rateLimits } from '@/lib/rate-limit';

import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  // Rate Limiting 체크
  const rateLimitResult = await rateLimits.checkEmail(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
        retryAfter: rateLimitResult.reset.toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000).toString()
        }
      }
    );
  }

  try {
    const { email } = await request.json();

    // 이메일 도메인 검증
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json({
        available: false,
        reason: 'INVALID_DOMAIN',
        message: '허용되지 않은 이메일 도메인입니다.'
      });
    }

    // user_profiles 테이블에서 이메일 확인 (Prisma)
    const existingProfile = await prisma.user_profiles.findUnique({
      where: { email },
      select: {
        email: true,
        role: true,
        is_active: true
      }
    });

    if (existingProfile) {
      // 거부되거나 비활성 사용자는 재가입 가능
      const isRejected = existingProfile.role === 'rejected' || existingProfile.is_active === false;

      if (!isRejected) {
        return NextResponse.json(
          {
            available: false,
            reason: 'EMAIL_EXISTS',
            message: '이미 사용 중인 이메일입니다.'
          },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
      }
    }

    return NextResponse.json(
      {
        available: true,
        message: '사용 가능한 이메일입니다.'
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    console.error('이메일 확인 오류:', error);
    return NextResponse.json(
      { error: '이메일 확인 중 오류가 발생했습니다. 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
