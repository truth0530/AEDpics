import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkBeforeCreatingSession } from '@/lib/inspections/session-validation';
import { logger } from '@/lib/logger';

/**
 * 점검 세션 생성 전 검증 API
 * GET /api/inspections/sessions/validate?equipmentSerial=XXX
 *
 * 재발 방지:
 * - 같은 장비에 이미 활성 세션이 있는지 확인
 * - 중복 세션이 있는지 확인
 * - 사용자 친화적인 에러 메시지 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const equipmentSerial = request.nextUrl.searchParams.get('equipmentSerial');

    if (!equipmentSerial) {
      return NextResponse.json(
        { error: 'equipmentSerial is required' },
        { status: 400 }
      );
    }

    const result = await checkBeforeCreatingSession(equipmentSerial);

    logger.info('InspectionSessionValidation:GET', 'Session creation validation', {
      equipmentSerial,
      canCreate: result.canCreate,
      userId: session.user.id
    });

    return NextResponse.json({
      success: true,
      canCreate: result.canCreate,
      message: result.message,
      existingSession: result.existingSession
    });
  } catch (error) {
    logger.error('InspectionSessionValidation:GET', 'Validation error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
