import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSimpleEmail, NCPEmailConfig } from '@/lib/email/ncp-email';
import { sendPushNotification } from '@/lib/push/vapid';

/**
 * CRON API: 방치된 문제에 대한 알림 발송
 *
 * 조건:
 * - 30일 이상 방치된 문제
 * - critical/major 심각도
 * - 아직 개선되지 않은 상태
 *
 * 대상:
 * - 해당 지역 보건소 담당자
 * - 시도 관리자
 * - 마스터 계정
 */
export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET 인증
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('CRON:send-improvement-alerts', '인증 실패');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('CRON:send-improvement-alerts', 'CRON 작업 시작');

    const startTime = Date.now();

    // 30일 이상 방치된 critical/major 문제 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const neglectedProblems = await prisma.inspection_field_comparisons.findMany({
      where: {
        status_at_inspection: 'problematic',
        improvement_status: 'neglected',
        issue_severity: { in: ['critical', 'major'] },
        days_since_inspection: { gte: 30 },
        inspection_time: { lte: thirtyDaysAgo },
      },
      include: {
        inspection: {
          select: {
            inspection_date: true,
            user_profiles: {
              select: {
                full_name: true,
                email: true,
              },
            },
          },
        },
        aed_device: {
          select: {
            equipment_serial: true,
            installation_institution: true,
            sido: true,
            gugun: true,
            jurisdiction_health_center: true,
          },
        },
      },
    });

    if (neglectedProblems.length === 0) {
      logger.info('CRON:send-improvement-alerts', '방치된 문제 없음');
      return NextResponse.json({
        success: true,
        message: '방치된 문제가 없습니다',
        count: 0,
      });
    }

    // 지역별로 그룹화
    const problemsByRegion = new Map<string, typeof neglectedProblems>();

    neglectedProblems.forEach(problem => {
      const region = problem.aed_device.gugun || problem.aed_device.sido;
      if (!problemsByRegion.has(region)) {
        problemsByRegion.set(region, []);
      }
      problemsByRegion.get(region)!.push(problem);
    });

    let sentCount = 0;

    // 지역별로 알림 발송
    for (const [region, problems] of problemsByRegion.entries()) {
      // 해당 지역의 보건소 담당자 조회
      const localAdmins = await prisma.user_profiles.findMany({
        where: {
          role: 'local_admin',
          region_code: region,
          is_active: true,
          email_notifications: true,
        },
        select: {
          email: true,
          full_name: true,
        },
      });

      // 시도 관리자 조회
      const sido = problems[0].aed_device.sido;
      const regionalAdmins = await prisma.user_profiles.findMany({
        where: {
          role: 'regional_admin',
          region_code: sido,
          is_active: true,
          email_notifications: true,
        },
        select: {
          email: true,
          full_name: true,
        },
      });

      // 수신자 목록
      const recipients = [
        ...localAdmins.map(a => a.email),
        ...regionalAdmins.map(a => a.email),
      ];

      if (recipients.length === 0) {
        logger.warn('CRON:send-improvement-alerts', `${region} 지역 수신자 없음`);
        continue;
      }

      // 이메일 내용 생성
      const problemsList = problems.map(p => {
        const fieldLabels: Record<string, string> = {
          battery_expiry_date: '배터리 만료일',
          pad_expiry_date: '패드 만료일',
          manager: '관리자명',
          institution_contact: '연락처',
          installation_institution: '설치기관',
          external_display: '외부표출',
        };

        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${p.aed_device.equipment_serial}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${p.aed_device.installation_institution}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${fieldLabels[p.field_name] || p.field_name}</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: ${p.issue_severity === 'critical' ? '#dc2626' : '#f59e0b'}; font-weight: bold;">
              ${p.issue_severity === 'critical' ? 'CRITICAL' : 'MAJOR'}
            </td>
            <td style="padding: 8px; border: 1px solid #ddd;">${p.days_since_inspection}일</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${new Date(p.inspection_time).toLocaleDateString('ko-KR')}</td>
          </tr>
        `;
      }).join('');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ AED 데이터 개선 필요 알림</h2>

          <p><strong>${region}</strong> 지역에서 <strong>30일 이상 방치된 중요한 문제</strong>가 발견되었습니다.</p>

          <p>다음 문제들에 대한 즉시 개선이 필요합니다:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">장비연번</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">설치기관</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">문제 필드</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">심각도</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">경과일</th>
                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">점검일</th>
              </tr>
            </thead>
            <tbody>
              ${problemsList}
            </tbody>
          </table>

          <div style="background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">조치 필요</p>
            <p style="margin: 10px 0 0 0; color: #92400e;">
              점검에서 발견된 문제가 30일 이상 개선되지 않았습니다.
              e-gen 시스템에서 해당 정보를 업데이트해주시기 바랍니다.
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            상세 정보는 <a href="${process.env.NEXT_PUBLIC_SITE_URL}/inspections/improvement-reports">AED 점검 시스템</a>에서 확인하실 수 있습니다.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />

          <p style="color: #9ca3af; font-size: 12px;">
            이 메일은 자동 발송되었습니다. 알림을 받지 않으시려면
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/profile">프로필 설정</a>에서 이메일 알림을 비활성화하세요.
          </p>
        </div>
      `;

      // NCP 이메일 설정
      const emailConfig: NCPEmailConfig = {
        accessKey: process.env.NCP_ACCESS_KEY || '',
        accessSecret: process.env.NCP_ACCESS_SECRET || '',
        senderAddress: process.env.NCP_SENDER_EMAIL || 'noreply@nmc.or.kr',
        senderName: 'AED 픽스'
      };

      // 이메일 발송
      for (const recipient of recipients) {
        try {
          await sendSimpleEmail(
            emailConfig,
            recipient,
            recipient,
            `[AED 점검] ${region} 지역 데이터 개선 필요 (${problems.length}건)`,
            htmlBody
          );
          sentCount++;
        } catch (error) {
          logger.error('CRON:send-improvement-alerts', '이메일 발송 실패', {
            recipient,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // 푸시 알림 발송
      const userIds = [
        ...localAdmins.map(a => a.email),
        ...regionalAdmins.map(a => a.email),
      ];

      const pushSubscriptions = await prisma.push_subscriptions.findMany({
        where: {
          user: {
            email: { in: userIds },
            is_active: true,
          },
        },
        select: {
          endpoint: true,
          p256dh_key: true,
          auth_key: true,
          id: true,
        },
      });

      for (const sub of pushSubscriptions) {
        try {
          const success = await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key,
              },
            },
            {
              title: `${region} 지역 데이터 개선 필요`,
              body: `${problems.length}건의 문제가 30일 이상 방치되었습니다`,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              data: {
                url: '/inspections/improvement-reports',
                region,
                problemCount: problems.length,
              },
            }
          );

          if (success) {
            await prisma.push_subscriptions.update({
              where: { id: sub.id },
              data: { last_used_at: new Date() },
            });
          }
        } catch (error) {
          logger.error('CRON:send-improvement-alerts', '푸시 알림 발송 실패', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.info('CRON:send-improvement-alerts', 'CRON 작업 완료', {
      totalProblems: neglectedProblems.length,
      regions: problemsByRegion.size,
      emailsSent: sentCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      totalProblems: neglectedProblems.length,
      regions: problemsByRegion.size,
      emailsSent: sentCount,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('CRON:send-improvement-alerts', 'CRON 작업 실패', error instanceof Error ? error : { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
