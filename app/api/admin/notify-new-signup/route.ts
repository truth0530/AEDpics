import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { getMasterAdminEmails, canApproveUsers } from '@/lib/auth/config';
import { sendSmartEmail } from '@/lib/email/ncp-email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { UserRole } from '@/packages/types';

import { prisma } from '@/lib/prisma';

/**
 * 승인 권한 역할 목록
 * canApproveUsers() 함수와 동기화 필수
 */
const APPROVER_ROLES: UserRole[] = ['master', 'emergency_center_admin', 'regional_emergency_center_admin'];

/**
 * 수신자 도메인에 따라 최적의 발신자 이메일 선택
 *
 * DMARC 정책 준수:
 * - @nmc.or.kr 수신자 → noreply@nmc.or.kr (도메인 일치)
 * - 기타 도메인 → noreply@nmc.or.kr (2025-11-07: @aed.pics DMARC 미설정으로 일시 비활성화)
 *
 * TODO: @aed.pics DMARC 설정 완료 후 활성화
 */
function selectNotificationSender(recipientEmail: string): string {
  // 현재: 모든 도메인에 noreply@nmc.or.kr 사용
  // 이유: @aed.pics는 DMARC 설정이 완료될 때까지 대기
  // 참고: lib/email/ncp-email.ts의 selectSenderEmail과 동기화
  return 'noreply@nmc.or.kr';
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, organizationName, region, regionCode, accountType } = await request.json();

    // Master 관리자 이메일 목록 가져오기
    const masterEmails = new Set(getMasterAdminEmails());

    // 실제 승인 권한이 있는 사용자만 조회
    // - master / emergency_center_admin: 지역 제약 없음
    // - regional_emergency_center_admin: regionCode와 일치하는 지역의 관리자만
    // - 상태: is_active = true
    // - 권한: canApproveUsers(role) = true

    // regional_emergency_center_admin 조회 필터
    let adminProfiles;

    if (regionCode) {
      // regionCode가 제공된 경우: master, emergency_center_admin, 해당 지역의 regional_emergency_center_admin
      adminProfiles = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          AND: [
            {
              OR: [
                // master와 emergency_center_admin은 지역 제약 없음
                { role: 'master' },
                { role: 'emergency_center_admin' },
                // regional_emergency_center_admin은 해당 지역만
                {
                  role: 'regional_emergency_center_admin',
                  region_code: regionCode
                }
              ]
            }
          ]
        },
        select: {
          email: true,
          full_name: true,
          role: true
        },
      });
    } else {
      // regionCode 없으면 master와 emergency_center_admin만
      adminProfiles = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          role: { in: ['master', 'emergency_center_admin'] }
        },
        select: {
          email: true,
          full_name: true,
          role: true
        },
      });
    }

    // 승인 권한 보유자만 알림 대상에 포함
    const adminEmailMap = new Map<string, string>();

    logger.info('API:notifyNewSignup', 'Admin profile filtering', {
      newUser: email,
      region: region,
      regionCode: regionCode,
      totalAdminsFound: adminProfiles?.length || 0,
      admins: adminProfiles?.map(p => ({ email: p.email, role: p.role })) || []
    });

    for (const profile of adminProfiles || []) {
      // canApproveUsers() 함수로 최종 권한 검증
      if (!canApproveUsers(profile.role as UserRole)) {
        logger.debug('API:notifyNewSignup', 'Skipping profile: insufficient approval permission', {
          email: profile.email,
          role: profile.role
        });
        continue;
      }
      adminEmailMap.set(profile.email, profile.full_name || '관리자');
      masterEmails.delete(profile.email);
    }

    logger.info('API:notifyNewSignup', 'Filtered admin emails for notification', {
      newUser: email,
      region: region,
      regionCode: regionCode,
      notificationRecipients: Array.from(adminEmailMap.keys())
    });

    // MASTER_EMAIL 동기화 확인
    // 문제: MASTER_EMAIL이 환경변수에 정의되어 있지만 DB에 프로필이 없으면?
    // 해결: 환경변수로 정의된 MASTER_EMAIL이 adminEmailMap에 없으면 경고 + 추가 로그
    if (masterEmails.size > 0) {
      logger.warn('API:notifyNewSignup', 'CRITICAL: Master emails missing from database', {
        missingEmails: Array.from(masterEmails),
        message: 'MASTER_EMAIL is defined in env but profile not found in database',
        action: 'Ensure MASTER_EMAIL profile exists in user_profiles table'
      });
    }

    // 승인자 없음 상태: 에러로 처리 (경고 대신)
    if (adminEmailMap.size === 0) {
      logger.error('API:notifyNewSignup', 'CRITICAL: No approvers available for notification', {
        newUser: email,
        masterEmailsInEnv: Array.from(masterEmails).length,
        masterEmailsMissing: Array.from(masterEmails),
        message: 'Cannot notify admin approval because no approver profiles found in database'
      });

      return NextResponse.json({
        success: false,
        error: 'No administrators available to process this request',
        notifiedAdmins: 0
      }, { status: 503 }); // Service Unavailable
    }

    // 각 관리자에게 이메일 발송
    // - 도메인별 발신자 선택
    // - 재시도 로직 포함 (3회)
    // - 개별 실패는 로그만 남기고 계속 진행
    const emailResults = {
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ email: string; error: string }>
    };

    const emailPromises = Array.from(adminEmailMap.entries()).map(async ([adminEmail, adminName]) => {
      try {
        // 수신자 도메인에 따라 발신자 선택
        const selectedSender = selectNotificationSender(adminEmail);

        if (!selectedSender || !selectedSender.includes('@')) {
          throw new Error(`Invalid sender email: ${selectedSender}`);
        }

        await sendSmartEmail(
          {
            accessKey: env.NCP_ACCESS_KEY!,
            accessSecret: env.NCP_ACCESS_SECRET!,
            senderAddress: selectedSender,
            senderName: 'AED 픽스'
          },
          adminEmail,
          adminName,
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

        emailResults.succeeded++;

        logger.info('API:notifyNewSignup', 'Notification email sent successfully', {
          to: adminEmail,
          recipientName: adminName,
          senderAddress: selectedSender,
          newUser: email
        });
      } catch (error) {
        emailResults.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        emailResults.errors.push({
          email: adminEmail,
          error: errorMessage
        });

        logger.error('API:notifyNewSignup', 'Failed to send notification email', {
          to: adminEmail,
          adminName: adminName,
          error: errorMessage,
          newUser: email,
          message: 'Individual email send failed, but other notifications may have succeeded'
        });
      }
    });

    await Promise.all(emailPromises);

    // 모든 발송 시도 완료
    const allFailed = emailResults.succeeded === 0 && adminEmailMap.size > 0;

    if (allFailed) {
      logger.error('API:notifyNewSignup', 'CRITICAL: All notification emails failed', {
        newUser: email,
        totalAdmins: adminEmailMap.size,
        failedCount: emailResults.failed,
        errors: emailResults.errors
      });

      return NextResponse.json({
        success: false,
        error: 'Failed to send all notification emails',
        notifiedAdmins: 0,
        details: { failed: emailResults.failed, total: adminEmailMap.size }
      }, { status: 500 });
    }

    // 부분 실패 또는 전체 성공
    logger.info('API:notifyNewSignup', 'Notification emails processed', {
      newUser: email,
      newUserName: fullName,
      totalAdmins: adminEmailMap.size,
      succeeded: emailResults.succeeded,
      failed: emailResults.failed,
      failedDetails: emailResults.errors.length > 0 ? emailResults.errors : undefined
    });

    return NextResponse.json({
      success: emailResults.succeeded > 0,
      notifiedAdmins: emailResults.succeeded,
      totalAdmins: adminEmailMap.size,
      failedCount: emailResults.failed,
      message: emailResults.failed > 0
        ? `Successfully notified ${emailResults.succeeded} of ${adminEmailMap.size} admins`
        : `Successfully notified all ${emailResults.succeeded} admins`
    });
  } catch (error) {
    logger.error('API:notifyNewSignup', 'Unexpected error sending admin notifications', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: 'Failed to process notification request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
