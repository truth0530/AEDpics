import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { getMasterAdminEmails } from '@/lib/auth/config';
import { sendSimpleEmail } from '@/lib/email/ncp-email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, organizationName, region, accountType } = await request.json();

    // Master 관리자 이메일 목록 가져오기
    const masterEmails = getMasterAdminEmails();

    // 추가로 실제 승인 권한이 있는 관리자들만 가져오기
    // ministry_admin은 제외 (승인 권한 없음)
    const adminProfiles = await prisma.user_profiles.findMany({
      where: {
        role: { in: ['master', 'emergency_center_admin'] }, // ministry_admin 제외
        is_active: true,
      },
      select: {
        email: true,
        full_name: true, // 실제 이름도 가져오기
      },
    });

    // 이메일과 이름을 매핑
    const adminEmailMap = new Map<string, string>();

    // Master 이메일들 처리
    for (const masterEmail of masterEmails) {
      // Master 이메일의 실제 이름 조회
      const masterProfile = await prisma.user_profiles.findUnique({
        where: { email: masterEmail },
        select: { full_name: true }
      });
      adminEmailMap.set(masterEmail, masterProfile?.full_name || '관리자');
    }

    // 데이터베이스에서 가져온 관리자들 처리
    for (const profile of adminProfiles || []) {
      adminEmailMap.set(profile.email, profile.full_name || '관리자');
    }

    // 각 관리자에게 이메일 발송
    const emailPromises = Array.from(adminEmailMap.entries()).map(async ([adminEmail, adminName]) => {
      try {
        await sendSimpleEmail(
          {
            accessKey: env.NCP_ACCESS_KEY!,
            accessSecret: env.NCP_ACCESS_SECRET!,
            senderAddress: env.NCP_SENDER_EMAIL!,
            senderName: 'AED 픽스'
          },
          adminEmail,
          adminName,  // ✅ 실제 이름 사용 (양미연, 이경진 등)
          `[AED 시스템] 새로운 회원가입 승인 요청 - ${fullName}`,
          `
              <h2>새로운 회원가입 승인 요청</h2>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333;">가입자 정보</h3>
                <ul style="line-height: 1.8;">
                  <li><strong>이름:</strong> ${fullName}</li>
                  <li><strong>이메일:</strong> ${email}</li>
                  <li><strong>소속기관:</strong> ${organizationName}</li>
                  <li><strong>지역:</strong> ${region}</li>
                  <li><strong>계정 유형:</strong> ${accountType === 'public' ? '공공기관' : '일반(임시점검원)'}</li>
                </ul>
              </div>

              <div style="background: ${accountType === 'public' ? '#e8f5e9' : '#fff3e0'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: ${accountType === 'public' ? '#2e7d32' : '#e65100'};">
                  ${accountType === 'public'
                    ? '✓ 공공기관 이메일로 가입한 정식 담당자입니다.'
                    : '⚠️ 일반 이메일로 가입한 임시 점검원입니다.'}
                </p>
              </div>

              <div style="margin-top: 30px;">
                <a href="${env.NEXT_PUBLIC_SITE_URL}/admin/users"
                   style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  사용자 관리 페이지로 이동
                </a>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">

              <p style="color: #666; font-size: 12px;">
                이 이메일은 AED 점검 시스템에서 자동으로 발송되었습니다.<br>
                문의: truth0530@nmc.or.kr
              </p>
            `,
          { maxRetries: 3, initialDelay: 1000, exponentialBase: 2 }
        );

        logger.info('API:notifyNewSignup', 'Email sent successfully', {
          to: adminEmail,
          recipientName: adminName
        });
      } catch (error) {
        logger.error('API:notifyNewSignup', 'Failed to send notification email', {
          to: adminEmail,
          error: error instanceof Error ? error : { error }
        });
      }
    });

    await Promise.all(emailPromises);

    logger.info('API:notifyNewSignup', 'All notifications sent', {
      newUser: email,
      newUserName: fullName,
      notifiedCount: adminEmailMap.size
    });

    return NextResponse.json({
      success: true,
      notifiedAdmins: adminEmailMap.size
    });
  } catch (error) {
    logger.error('API:notifyNewSignup', 'Error sending admin notifications', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}