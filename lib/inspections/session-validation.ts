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

/**
 * Inspector ID 기반 검증 (개선된 버전) - Priority 3 구현 예정
 * 자신의 세션은 재개 가능, 다른 사람의 세션은 차단
 *
 * 현재 상태: 함수 정의만 완료, API에서 미사용
 *
 * TODO (Priority 3): 다음이 필요합니다:
 * 1. app/api/inspections/sessions/route.ts의 POST 핸들러에서 이 함수 호출 추가
 * 2. 세션 재개(resume) 로직 구현 (현재는 "활성 세션 존재 → 모두 차단만" 운영)
 * 3. UI에서 재개 확인 대화창 추가
 * 4. 테스트 (race condition 확인 필수)
 *
 * @param equipmentSerial - 장비 시리얼
 * @param currentUserId - 현재 사용자 ID
 * @returns 검증 결과
 */
export async function validateSessionWithUserContext(
  equipmentSerial: string,
  currentUserId: string
): Promise<{
  allowed: boolean;
  action: 'create' | 'resume' | 'block'; // create: 새로 생성, resume: 기존 세션 재개, block: 차단
  existingSession?: any;
  reason?: string;
}> {
  const existingSession = await getActiveInspectionSession(equipmentSerial);

  if (!existingSession) {
    // 활성 세션이 없으면 새로 생성
    return {
      allowed: true,
      action: 'create',
      existingSession: null
    };
  }

  // 자신의 세션인가?
  const isOwnSession = existingSession.inspector_id === currentUserId;

  if (isOwnSession) {
    // 자신의 세션이면 재개 가능
    return {
      allowed: true,
      action: 'resume',
      existingSession,
      reason: '기존 점검 세션을 재개합니다.'
    };
  }

  // 다른 사람의 세션이면 차단
  return {
    allowed: false,
    action: 'block',
    existingSession,
    reason: `다른 점검자(${existingSession.user_profiles?.full_name || '알 수 없음'})가 이미 점검 중입니다. (시작: ${existingSession.started_at})`
  };
}
