import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { normalizeRegionCode } from '@/lib/constants/regions';

// 성능 모니터링 메트릭
interface PerformanceMetrics {
  totalQueries: number;
  totalNotificationsSent: number;
  totalNotificationsSaved: number;
  averageQueryTime: number;
  connectionStartTime: Date;
  lastQueryTime?: number;
}

// SSE 스트림을 위한 TransformStream 사용
export async function GET(request: NextRequest) {
  // 인증 확인
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 사용자 프로필 조회
  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      region_code: true,
      can_approve_users: true,
    },
  });

  if (!userProfile || !userProfile.can_approve_users) {
    return new Response('Forbidden', { status: 403 });
  }

  // 성능 모니터링 초기화
  const metrics: PerformanceMetrics = {
    totalQueries: 0,
    totalNotificationsSent: 0,
    totalNotificationsSaved: 0,
    averageQueryTime: 0,
    connectionStartTime: new Date(),
  };

  // SSE 스트림 생성
  const encoder = new TextEncoder();
  let isActive = true;
  let lastCheckedTime = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // 연결 확인용 heartbeat (30초마다)
      const heartbeatInterval = setInterval(() => {
        if (!isActive) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (error) {
          console.error('[SSE] Heartbeat failed:', error);
          isActive = false;
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // 새로운 승인 대기자 체크 (5초마다)
      const checkInterval = setInterval(async () => {
        if (!isActive) {
          clearInterval(checkInterval);
          return;
        }

        try {
          // 성능 측정 시작
          const queryStartTime = Date.now();
          metrics.totalQueries++;

          // 마지막 체크 이후 생성된 pending_approval 사용자 조회
          const newUsers = await prisma.user_profiles.findMany({
            where: {
              role: 'pending_approval',
              created_at: {
                gt: lastCheckedTime,
              },
            },
            select: {
              id: true,
              email: true,
              full_name: true,
              region_code: true,
              organization_name: true,
              created_at: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          });

          // 쿼리 시간 측정 및 평균 계산
          const queryTime = Date.now() - queryStartTime;
          metrics.lastQueryTime = queryTime;
          metrics.averageQueryTime =
            (metrics.averageQueryTime * (metrics.totalQueries - 1) + queryTime) / metrics.totalQueries;

          lastCheckedTime = new Date();

          if (newUsers.length > 0) {
            // 역할별 필터링
            const filteredUsers = newUsers.filter((user) => {
              // Master는 모든 신청 알림
              if (userProfile.role === 'master') {
                return true;
              }

              // 중앙응급의료센터는 모든 신청 알림
              if (userProfile.role === 'emergency_center_admin') {
                return true;
              }

              // 응급의료지원센터는 해당 지역만
              if (userProfile.role === 'regional_emergency_center_admin') {
                const newUserRegion = normalizeRegionCode(user.region_code || '');
                return newUserRegion === userProfile.region_code;
              }

              // 기타 역할은 알림 없음
              return false;
            });

            // 필터링된 사용자가 있으면 SSE 이벤트 전송 및 히스토리 저장
            if (filteredUsers.length > 0) {
              const data = JSON.stringify({
                type: 'new_signup',
                users: filteredUsers,
                timestamp: new Date().toISOString(),
              });

              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );

              metrics.totalNotificationsSent += filteredUsers.length;

              // 알림 히스토리 DB 저장 (비동기, 실패해도 알림은 전송됨)
              try {
                const notificationRecords = filteredUsers.map((user) => ({
                  recipient_id: userProfile.id,
                  new_user_id: user.id,
                  new_user_email: user.email,
                  new_user_name: user.full_name,
                  new_user_region: user.region_code,
                  new_user_org: user.organization_name,
                  notification_type: 'new_signup',
                  is_read: false,
                }));

                await prisma.approval_notifications.createMany({
                  data: notificationRecords,
                });

                metrics.totalNotificationsSaved += filteredUsers.length;

                console.log('[SSE] Notification saved to DB:', {
                  count: filteredUsers.length,
                  recipient: userProfile.id,
                });
              } catch (dbError) {
                console.error('[SSE] Failed to save notification to DB:', dbError);
                // DB 저장 실패해도 SSE는 이미 전송되었으므로 계속 진행
              }

              console.log('[SSE] New signup notification sent:', {
                count: filteredUsers.length,
                role: userProfile.role,
                region: userProfile.region_code,
                queryTime: `${queryTime}ms`,
                avgQueryTime: `${metrics.averageQueryTime.toFixed(2)}ms`,
              });
            }
          }
        } catch (error) {
          console.error('[SSE] Check interval failed:', error);
          // 에러가 발생해도 계속 시도
        }
      }, 5000); // 5초마다 체크

      // 클라이언트 연결 종료 시 정리
      request.signal.addEventListener('abort', () => {
        const connectionDuration = Date.now() - metrics.connectionStartTime.getTime();
        const durationMinutes = (connectionDuration / 60000).toFixed(2);

        console.log('[SSE] Client disconnected - Session Summary:', {
          userId: userProfile.id,
          role: userProfile.role,
          duration: `${durationMinutes} minutes`,
          totalQueries: metrics.totalQueries,
          totalNotificationsSent: metrics.totalNotificationsSent,
          totalNotificationsSaved: metrics.totalNotificationsSaved,
          avgQueryTime: `${metrics.averageQueryTime.toFixed(2)}ms`,
        });

        isActive = false;
        clearInterval(heartbeatInterval);
        clearInterval(checkInterval);
        try {
          controller.close();
        } catch (error) {
          // 이미 닫혀있을 수 있음
        }
      });

      // 초기 연결 메시지
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`)
      );
      console.log('[SSE] New connection established:', {
        userId: userProfile.id,
        role: userProfile.role,
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
    },
  });
}
