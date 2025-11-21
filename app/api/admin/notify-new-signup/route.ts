import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { getMasterAdminEmails, canApproveUsers } from '@/lib/auth/config';
import { sendSmartEmail } from '@/lib/email/ncp-email';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { UserRole } from '@/packages/types';
import { getRegionCode } from '@/lib/constants/regions';

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
 * - 기타 도메인 → noreply@aed.pics (네이버, Gmail 등)
 *
 * 변경 이력:
 * - 2025-11-07: 비활성화 (잘못된 가정)
 * - 2025-11-13: 재활성화 (과거 검증된 성공 패턴 복구)
 *
 * 참고: lib/email/ncp-email.ts의 selectSenderEmail과 동기화
 * 상세: docs/troubleshooting/SENDER_SELECTION_POLICY_ANALYSIS_2025-11-13.md
 */
function selectNotificationSender(recipientEmail: string): string {
  // 2025-11-13 재활성화: 네이버 DMARC 차단 문제 해결
  // lib/email/ncp-email.ts의 selectSenderEmail과 동일한 로직
  // 2025-11-21 Daum 차단 대응: Daum/Hanmail은 noreply@nmc.or.kr 사용
  const domain = recipientEmail.split('@')[1]?.toLowerCase();

  // NMC 도메인: 같은 도메인 사용 (DMARC 정책)
  if (domain === 'nmc.or.kr') return 'noreply@nmc.or.kr';

  // Daum/Hanmail: noreply@aed.pics가 차단되므로 nmc.or.kr 사용
  if (domain === 'daum.net' || domain === 'hanmail.net') {
    return 'noreply@nmc.or.kr';
  }

  // 기타 도메인 (네이버, Gmail 등): 기존 패턴 유지
  return 'noreply@aed.pics';
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, organizationName, region, regionCode, accountType } = await request.json();

    // Master 관리자 이메일 목록 가져오기
    const masterEmails = new Set(getMasterAdminEmails());

    // 지역 코드 정규화 (통합 관리 시스템 활용)
    // signup에서 이미 getRegionCode를 거쳤지만, 안전을 위해 한 번 더 검증
    const normalizedRegionCode = regionCode ? getRegionCode(region) || regionCode : undefined;

    logger.info('API:notifyNewSignup', 'Region code normalization', {
      originalRegion: region,
      receivedRegionCode: regionCode,
      normalizedRegionCode: normalizedRegionCode,
      changed: regionCode !== normalizedRegionCode
    });

    // 실제 승인 권한이 있는 사용자만 조회
    // 2025-11-13 개선: 지역별 알림 수신자 최적화
    // - master: 전국 알림 (최소 인원만)
    // - regional_emergency_center_admin: 해당 지역만 알림
    // - emergency_center_admin: 제외 (중앙센터는 모든 지역 알림 불필요)
    // - 상태: is_active = true
    // - 권한: canApproveUsers(role) = true

    let adminProfiles;

    if (normalizedRegionCode) {
      // regionCode가 제공된 경우: master + 해당 지역의 regional_emergency_center_admin만
      adminProfiles = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          OR: [
            // master는 전국 알림 (최소 인원)
            { role: 'master' },
            // regional_emergency_center_admin은 해당 지역만
            {
              role: 'regional_emergency_center_admin',
              region_code: normalizedRegionCode
            }
          ]
        },
        select: {
          email: true,
          full_name: true,
          role: true,
          region_code: true
        },
      });
    } else {
      // regionCode 없으면 master만 (안전 장치)
      adminProfiles = await prisma.user_profiles.findMany({
        where: {
          is_active: true,
          role: 'master'
        },
        select: {
          email: true,
          full_name: true,
          role: true,
          region_code: true
        },
      });
    }

    // 승인 권한 보유자만 알림 대상에 포함
    const adminEmailMap = new Map<string, string>();

    logger.info('API:notifyNewSignup', 'Admin profile filtering', {
      newUser: email,
      region: region,
      normalizedRegionCode: normalizedRegionCode,
      totalAdminsFound: adminProfiles?.length || 0,
      admins: adminProfiles?.map(p => ({ email: p.email, role: p.role, region_code: p.region_code })) || []
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
      normalizedRegionCode: normalizedRegionCode,
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
