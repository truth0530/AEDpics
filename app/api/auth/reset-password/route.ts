import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendSimpleEmail } from '@/lib/email/ncp-email';
import { checkEmailRateLimit } from '@/lib/email/email-rate-limiter';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // NCP 이메일 환경변수 검증
    if (!process.env.NCP_ACCESS_KEY || !process.env.NCP_ACCESS_SECRET || !process.env.NCP_SENDER_EMAIL) {
      console.error('NCP Email 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '이메일 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.' },
        { status: 503 }
      );
    }

    // 환경변수 검증
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!appUrl) {
      console.error('NEXT_PUBLIC_SITE_URL 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요.' },
        { status: 500 }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 사용자 확인
    const profile = await prisma.user_profiles.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        full_name: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: '등록되지 않은 이메일입니다.' },
        { status: 404 }
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

    // 보안 토큰 생성 (6자리 숫자)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15분 후 만료

    // 토큰을 데이터베이스에 저장
    try {
      await prisma.email_verification_codes.create({
        data: {
          email,
          code: resetToken,
          expires_at: expiresAt,
        },
      });
    } catch (insertError) {
      console.error('토큰 저장 실패:', insertError);
      return NextResponse.json(
        { error: '비밀번호 재설정 요청 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 이메일 URL 생성 (환경변수 확인됨)
    const resetPasswordUrl = `${appUrl}/auth/verify-reset?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // HTML 템플릿 생성
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px solid #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .code { font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>비밀번호 재설정</h1>
          </div>
          <div class="content">
            <p>안녕하세요, ${profile.full_name || '사용자'}님</p>
            <p>비밀번호 재설정을 요청하셨습니다. 아래 인증 코드를 사용하여 비밀번호를 재설정하세요.</p>
            
            <div class="code-box">
              <div class="code">${resetToken}</div>
              <p style="color: #666; font-size: 14px;">유효시간: 15분</p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${resetPasswordUrl}" class="button" style="display: inline-block; padding: 15px 40px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                비밀번호 재설정하기
              </a>
            </p>

            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              위 버튼이 작동하지 않으면 아래 링크를 복사해서 브라우저에 붙여넣으세요:
            </p>
            <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #666;">
              ${resetPasswordUrl}
            </p>

            <div class="warning">
              <strong>⚠️ 보안 안내:</strong><br>
              본인이 요청하지 않은 경우, 이 이메일을 무시하시고 계정 보안을 확인해주세요.
            </div>
            
            <div class="footer">
              <p>중앙응급의료센터 AED 점검 시스템</p>
              <p>문의: truth0530@nmc.or.kr</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // NCP Cloud Outbound Mailer로 이메일 발송
    console.log(`[비밀번호 재설정] 이메일 발송 시작: ${email}, 토큰: ${resetToken}`);
    try {
      const emailResult = await sendSimpleEmail(
        {
          accessKey: process.env.NCP_ACCESS_KEY!,
          accessSecret: process.env.NCP_ACCESS_SECRET!,
          senderAddress: process.env.NCP_SENDER_EMAIL!,
          senderName: 'AED 픽스'
        },
        email,
        profile.full_name || '사용자',
        'AED 점검 시스템 - 비밀번호 재설정',
        htmlTemplate,
        {
          maxRetries: 3,
          initialDelay: 1000,
          exponentialBase: 2
        }
      );
      console.log(`[비밀번호 재설정] NCP 이메일 발송 성공:`, emailResult);
    } catch (emailError) {
      console.error('[비밀번호 재설정] NCP Email 발송 실패:', emailError);
      return NextResponse.json(
        { error: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    console.log(`[비밀번호 재설정] 처리 완료: ${email}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
