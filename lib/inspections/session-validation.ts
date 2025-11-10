import { prisma } from '@/lib/prisma';

/**
 * 장비에 대한 활성 점검 세션 존재 여부 확인
 * @param equipmentSerial - 장비 시리얼
 * @returns 활성 세션이 있으면 true, 없으면 false
 */
export async function hasActiveInspectionSession(equipmentSerial: string): Promise<boolean> {
  const activeSession = await prisma.inspection_sessions.findFirst({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    }
  });

  return !!activeSession;
}

/**
 * 활성 점검 세션 조회
 * @param equipmentSerial - 장비 시리얼
 * @returns 활성 세션 정보 또는 null
 */
export async function getActiveInspectionSession(equipmentSerial: string) {
  return await prisma.inspection_sessions.findFirst({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    },
    include: {
      user_profiles: {
        select: {
          id: true,
          full_name: true,
          email: true
        }
      }
    },
    orderBy: { started_at: 'desc' }
  });
}

/**
 * 중복 활성 세션 여부 확인 (2개 이상)
 * @param equipmentSerial - 장비 시리얼
 * @returns 중복 세션이 있으면 true, 없으면 false
 */
export async function hasDuplicateActiveSessions(equipmentSerial: string): Promise<boolean> {
  const count = await prisma.inspection_sessions.count({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    }
  });

  return count > 1;
}

/**
 * 장비의 모든 활성 세션 조회
 * @param equipmentSerial - 장비 시리얼
 * @returns 활성 세션 배열
 */
export async function getAllActiveInspectionSessions(equipmentSerial: string) {
  return await prisma.inspection_sessions.findMany({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    },
    select: {
      id: true,
      status: true,
      started_at: true,
      user_profiles: {
        select: {
          id: true,
          full_name: true,
          email: true
        }
      }
    },
    orderBy: { started_at: 'desc' }
  });
}

/**
 * 점검 세션 생성 전 검증 (재발 방지)
 * @param equipmentSerial - 장비 시리얼
 * @returns { allowed: boolean, reason?: string, existingSession?: any }
 */
export async function validateInspectionSessionCreation(
  equipmentSerial: string
): Promise<{
  allowed: boolean;
  reason?: string;
  existingSession?: any;
}> {
  // 1. 이미 활성 세션이 있는지 확인
  const existingSession = await getActiveInspectionSession(equipmentSerial);

  if (existingSession) {
    return {
      allowed: false,
      reason: `이미 진행 중인 점검 세션이 있습니다. (점검자: ${existingSession.user_profiles?.full_name}, 시작: ${existingSession.started_at})`,
      existingSession
    };
  }

  // 2. 중복 세션이 있는지 확인 (데이터 무결성 검증)
  const hasDuplicates = await hasDuplicateActiveSessions(equipmentSerial);

  if (hasDuplicates) {
    const allSessions = await getAllActiveInspectionSessions(equipmentSerial);
    return {
      allowed: false,
      reason: `데이터 오류: 같은 장비에 여러 세션이 존재합니다. 관리자에게 문의하세요.`,
      existingSession: allSessions[0]
    };
  }

  return { allowed: true };
}

/**
 * 점검 세션 생성 시 사전 체크 (사용자에게 친화적인 에러 메시지)
 */
export async function checkBeforeCreatingSession(
  equipmentSerial: string
): Promise<{
  canCreate: boolean;
  message: string;
  existingSession?: any;
}> {
  const validation = await validateInspectionSessionCreation(equipmentSerial);

  if (!validation.allowed) {
    return {
      canCreate: false,
      message: validation.reason || '점검 세션을 생성할 수 없습니다.',
      existingSession: validation.existingSession
    };
  }

  return {
    canCreate: true,
    message: '점검을 시작할 수 있습니다.'
  };
}
