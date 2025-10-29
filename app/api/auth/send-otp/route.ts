import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isAllowedEmailDomain } from '@/lib/auth/config';
import { rateLimits } from '@/lib/rate-limit';
import { checkOtpRateLimit } from '@/lib/auth/otp-rate-limiter';
import { sendSimpleEmail } from '@/lib/email/ncp-email';
import { checkEmailRateLimit } from '@/lib/email/email-rate-limiter';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  // 런타임 환경변수 검증 (빌드 시에는 체크하지 않음)
  if (!process.env.NCP_ACCESS_KEY || !process.env.NCP_ACCESS_SECRET || !process.env.NCP_SENDER_EMAIL) {
    return NextResponse.json(
      { error: 'Email service is not configured' },
      { status: 503 }
    );
  }

  try {
    const { email } = await request.json();

    // 이메일 도메인 검증 먼저 (불필요한 rate limit 체크 방지)
    if (!isAllowedEmailDomain(email)) {
      return NextResponse.json(
        { error: '허용되지 않은 이메일 도메인입니다.' },
        { status: 400 }
      );
    }

    // DB 기반 Rate Limiting 체크 (서버 사이드, 이메일 기반)
    const dbRateLimit = await checkOtpRateLimit(email);
    if (!dbRateLimit.allowed) {
      return NextResponse.json(
        {
          error: `OTP 요청 횟수 초과. ${Math.ceil(dbRateLimit.retryAfterSeconds! / 60)}분 후 다시 시도해주세요.`,
          retryAfter: dbRateLimit.resetAt.toISOString(),
          retryAfterSeconds: dbRateLimit.retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': dbRateLimit.remaining.toString(),
            'X-RateLimit-Reset': dbRateLimit.resetAt.toISOString(),
            'Retry-After': dbRateLimit.retryAfterSeconds!.toString()
          }
        }
      );
    }

    // 이메일 발송 빈도 체크 (NCP 스팸 필터 차단 방지)
    const emailRateLimit = await checkEmailRateLimit(email);
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error: emailRateLimit.reason,
          retryAfter: emailRateLimit.resetAt?.toISOString(),
          retryAfterSeconds: emailRateLimit.retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Type': 'Email-Frequency',
            'X-RateLimit-Remaining': emailRateLimit.remaining?.toString() || '0',
            'X-RateLimit-Reset': emailRateLimit.resetAt?.toISOString() || '',
            'Retry-After': emailRateLimit.retryAfterSeconds?.toString() || '300'
          }
        }
      );
    }

    // 클라이언트 사이드 Rate Limiting 체크 (IP 기반, 추가 보안 레이어)
    const clientRateLimit = await rateLimits.sendOtp(request);
    if (!clientRateLimit.success) {
      const retryAfterSeconds = Math.ceil((clientRateLimit.reset.getTime() - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
          retryAfter: clientRateLimit.reset.toISOString(),
          retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': clientRateLimit.limit.toString(),
            'X-RateLimit-Remaining': clientRateLimit.remaining.toString(),
            'X-RateLimit-Reset': clientRateLimit.reset.toISOString(),
            'Retry-After': retryAfterSeconds.toString()
          }
        }
      );
    }

    // 1. user_profiles 테이블 확인 - 활성 사용자만 체크 (거부된 사용자는 재가입 허용)
    const existingProfile = await prisma.user_profiles.findUnique({
      where: { email },
      select: {
        email: true,
        role: true,
        is_active: true,
        id: true
      }
    });

    if (existingProfile) {
      // 거부된 사용자(rejected)이거나 비활성 사용자는 재가입 허용
      const isRejected = existingProfile.role === 'rejected' || existingProfile.is_active === false;

      if (!isRejected) {
        return NextResponse.json(
          {
            error: '이미 가입된 이메일입니다. 로그인을 시도해주세요.',
            code: 'EMAIL_ALREADY_EXISTS'
          },
          { status: 409 } // Conflict
        );
      }

      // 거부된 사용자는 기존 프로필 삭제 후 재가입 진행
      await prisma.user_profiles.delete({
        where: { id: existingProfile.id }
      });
    }

    // 기존 OTP 정리 (동일 이메일의 모든 OTP 삭제 - 재발송 시 혼란 방지)
    await prisma.email_verification_codes.deleteMany({
      where: { email }
    });

    // 6자리 랜덤 코드 생성
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15분 후 만료

    // OTP를 데이터베이스에 저장
    const insertedOtp = await prisma.email_verification_codes.create({
      data: {
        email,
        code: otp,
        expires_at: expiresAt
      },
      select: {
        id: true
      }
    });

    const otpRecordId = insertedOtp.id;

    // NCP Cloud Outbound Mailer API를 재시도 로직과 함께 호출
    try {
      await sendSimpleEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: process.env.NCP_SENDER_EMAIL!,
          senderName: 'AED 픽스'
        },
        email,
        '사용자',
        `AED 점검 시스템 - 인증번호: ${otp}`,
        `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>AED 픽스 - 이메일 인증</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #030712 0%, #111827 50%, #030712 100%);">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #030712 0%, #111827 50%, #030712 100%); padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: rgba(17, 24, 39, 0.8); backdrop-filter: blur(16px); border-radius: 16px; border: 1px solid rgba(34, 197, 94, 0.2); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 197, 94, 0.1); overflow: hidden;">

                      <!-- Logo Header -->
                      <tr>
                        <td style="padding: 40px 30px 30px; text-align: center;">
                          <div style="display: inline-block; position: relative; width: 80px; height: 80px; margin-bottom: 20px;">
                            <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
                            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); border-radius: 50%;">
                              <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M50 85C50 85 20 60 20 40C20 30 25 25 32 25C38 25 44 28 50 35C56 28 62 25 68 25C75 25 80 30 80 40C80 60 50 85 50 85Z" fill="white"/>
                                <path d="M55 35L45 50H55L40 65L60 45H50L55 35Z" fill="#10b981" stroke="#10b981" stroke-width="2"/>
                              </svg>
                            </div>
                          </div>
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">AED 픽스</h1>
                          <p style="margin: 8px 0 0 0; font-size: 14px;">
                            <span style="color: #fcd34d; font-weight: 700;">AED</span>
                            <span style="color: #9ca3af;"> </span>
                            <span style="color: #fcd34d; font-weight: 700;">pic</span>
                            <span style="color: #9ca3af;">k up </span>
                            <span style="color: #fcd34d; font-weight: 700;">s</span>
                            <span style="color: #9ca3af;">ystem</span>
                          </p>
                        </td>
                      </tr>

                      <!-- Content -->
                      <tr>
                        <td style="padding: 0 30px 40px;">
                          <!-- OTP Box with Glow Effect -->
                          <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border: 2px solid rgba(34, 197, 94, 0.5); border-radius: 12px; padding: 30px 20px; text-align: center; margin-bottom: 24px; box-shadow: 0 0 40px rgba(34, 197, 94, 0.15);">
                            <p style="margin: 0 0 20px 0; color: #fbbf24; font-size: 14px; font-weight: 600; text-align: center;">
                              인증번호를 15분내에 입력해주세요
                            </p>
                            <div style="font-size: 52px; font-weight: 800; color: #22c55e; letter-spacing: 8px; user-select: all; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(34, 197, 94, 0.3);">
                              ${otp}
                            </div>
                          </div>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background: rgba(17, 24, 39, 0.8); padding: 24px 30px; text-align: center; border-top: 1px solid rgba(75, 85, 99, 0.3);">
                          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                            본 메일은 발신 전용입니다. 문의사항은 관할 응급의료지원센터로 연락해주세요.
                          </p>
                          <p style="margin: 0; color: #4b5563; font-size: 11px;">
                            © 2025 AED 픽스 aed.pics · 국립중앙의료원 중앙응급의료센터
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        {
          maxRetries: 3,
          initialDelay: 1000,
          exponentialBase: 2
        }
      );
    } catch (emailError) {
      console.error('Email send failed after retries:', emailError);

      // 이메일 발송 실패 시 저장된 OTP 삭제 (사용자 혼란 방지)
      await prisma.email_verification_codes.delete({
        where: { id: otpRecordId }
      });

      return NextResponse.json(
        { error: '이메일 발송 실패. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OTP 발송 오류:', error);
    return NextResponse.json(
      { error: '서버 오류' },
      { status: 500 }
    );
  }
}
