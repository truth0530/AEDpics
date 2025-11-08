import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inspectorEmail, inspectorName, organizationName, region, issue } = body;

    // 1. 마스터 관리자 찾기
    const masterAdmins = await prisma.user_profiles.findMany({
      where: {
        role: 'master',
        is_active: true
      },
      select: {
        id: true,
        email: true,
        full_name: true
      }
    });

    // 2. 해당 지역 regional_admin 찾기
    const regionalAdmins = await prisma.user_profiles.findMany({
      where: {
        role: 'regional_admin',
        region: region,
        is_active: true
      },
      select: {
        id: true,
        email: true,
        full_name: true
      }
    });

    // 3. 알림 생성
    const notifications = [];
    const allAdmins = [...masterAdmins, ...regionalAdmins];

    for (const admin of allAdmins) {
      notifications.push({
        title: '⚠️ 임시점검원 조직 할당 문제',
        message: `${inspectorName}(${inspectorEmail})님이 ${organizationName}에 가입을 시도했으나 ${issue}`,
        recipient_id: admin.id,
        type: 'orphan_inspector',
        created_at: new Date(),
        data: JSON.stringify({
          inspector_email: inspectorEmail,
          inspector_name: inspectorName,
          organization_name: organizationName,
          region: region,
          issue_type: issue
        })
      });
    }

    // 4. 알림 저장 (notifications 테이블이 있다면)
    // await prisma.notifications.createMany({ data: notifications });

    // 5. 이메일 알림 발송 (NCP 이메일 서비스)
    if (process.env.NCP_ACCESS_KEY && process.env.NCP_ACCESS_SECRET) {
      try {
        const emailPromises = allAdmins.map(admin =>
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: admin.email,
              subject: '[AED 픽스] 임시점검원 조직 할당 문제 알림',
              html: `
                <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #e53e3e;">⚠️ 임시점검원 조직 할당 문제</h2>

                  <div style="background: #fff5f5; border: 1px solid #fed7d7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #c53030; margin-top: 0;">문제 발생</h3>
                    <p style="margin: 5px 0;"><strong>점검원:</strong> ${inspectorName} (${inspectorEmail})</p>
                    <p style="margin: 5px 0;"><strong>조직:</strong> ${organizationName}</p>
                    <p style="margin: 5px 0;"><strong>지역:</strong> ${region}</p>
                    <p style="margin: 5px 0;"><strong>문제:</strong> ${issue}</p>
                  </div>

                  <div style="background: #fffaf0; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #c05621; margin-top: 0;">조치 필요</h3>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                      <li>해당 조직에 local_admin 계정을 생성하거나</li>
                      <li>임시점검원을 다른 조직으로 재할당하거나</li>
                      <li>시스템 관리자가 대리 할당을 수행해야 합니다</li>
                    </ul>
                  </div>

                  <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <p style="color: #718096; font-size: 14px;">
                      관리자 페이지에서 상세 내용을 확인하고 조치해주세요.<br>
                      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/users" style="color: #3182ce;">사용자 관리 페이지 바로가기</a>
                    </p>
                  </div>
                </div>
              `
            })
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('이메일 발송 실패:', emailError);
        // 이메일 실패해도 API는 성공 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: `${allAdmins.length}명의 관리자에게 알림 발송`
    });

  } catch (error) {
    console.error('알림 발송 오류:', error);
    return NextResponse.json(
      { success: false, error: '알림 발송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}