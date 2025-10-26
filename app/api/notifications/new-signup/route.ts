import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userEmail, userName, organizationName, region, accountType } = await request.json();

    // 알림을 받을 관리자들 조회
    const admins = await prisma.user_profiles.findMany({
      where: {
        role: {
          in: ['master', 'emergency_center_admin', 'regional_admin']
        },
        is_active: true
      },
      select: {
        id: true,
        role: true,
        region_code: true,
        email: true,
        full_name: true
      }
    });

    if (!admins || admins.length === 0) {
      console.log('No active admins found to notify');
      return Response.json({
        success: true,
        message: 'No admins to notify',
        notified: 0
      });
    }

    // 지역별 필터링 (지역 관리자는 해당 지역만)
    const relevantAdmins = admins.filter(admin => {
      if (admin.role === 'master' || admin.role === 'emergency_center_admin') {
        return true; // 마스터와 중앙응급의료센터는 모든 알림 받음
      }
      if (admin.role === 'regional_admin') {
        return admin.region_code === region; // 지역 관리자는 해당 지역만
      }
      return false;
    });

    console.log(`Found ${relevantAdmins.length} relevant admins to notify`);

    if (relevantAdmins.length === 0) {
      return Response.json({
        success: true,
        message: 'No relevant admins for this region',
        notified: 0
      });
    }

    // 알림 생성 API 호출
    const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: JSON.stringify({
        recipient_ids: relevantAdmins.map(admin => admin.id),
        type: 'new_signup',
        templateData: {
          userName,
          userEmail,
          organizationName,
          region,
          accountType: accountType === 'public' ? '공공기관' : '일반'
        },
        data: {
          userEmail,
          userName,
          organizationName,
          region,
          accountType,
          actionUrl: '/admin/users?filter=pending'
        }
      })
    });

    if (!notificationResponse.ok) {
      const errorText = await notificationResponse.text();
      console.error('Notification API error:', errorText);
      throw new Error(`Failed to create notifications: ${errorText}`);
    }

    const result = await notificationResponse.json();

    console.log(`Successfully created ${result.count} notifications for new signup: ${userName}`);

    return Response.json({
      success: true,
      notified: result.count || 0,
      admins: relevantAdmins.map(admin => ({
        name: admin.full_name,
        email: admin.email,
        role: admin.role
      }))
    });
  } catch (error) {
    console.error('New signup notification error:', error);
    return Response.json({
      error: 'Failed to send new signup notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}