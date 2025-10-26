import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { apiHandler } from '@/lib/api/error-handler';
import { canPerformInspection, AccessContext } from '@/lib/auth/access-control';
import { LRUCache } from 'lru-cache';

// Week 2: 중복 갱신 방지용 메모리 캐시
const refreshingSessionsCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5분
});

// 갱신 시작 타임스탬프 추적 (타임아웃용)
const refreshStartTimes = new LRUCache<string, number>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10분
});

interface StartSessionPayload {
  equipmentSerial?: string;
  deviceSnapshot?: Record<string, unknown> | null;
}

interface UpdateSessionPayload {
  sessionId?: string;
  currentStep?: number;
  stepData?: Record<string, unknown>;
  fieldChanges?: Record<string, unknown>;
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  notes?: string | null;
  finalizeData?: Record<string, unknown>;
}

async function requireAuthWithRole() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  // 사용자 프로필 조회하여 역할 확인
  const profile = await prisma.userProfile.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      assignedDevices: true,
      organizationId: true
    }
  });

  if (!profile) {
    throw new Error('User profile not found');
  }

  // account_type 컬럼이 존재하지 않으므로 기본값 'public' 사용
  const accessContext: AccessContext = {
    userId: profile.id,
    role: profile.role,
    accountType: 'public',
    assignedDevices: profile.assignedDevices || [],
    organizationId: profile.organizationId || undefined,
  };

  // 점검 권한 확인
  if (!canPerformInspection(accessContext)) {
    throw new Error('Inspection not permitted for this user');
  }

  return { userId: session.user.id, profile, accessContext } as const;
}

function mergeStepData(
  previous: Record<string, unknown> | null,
  incoming: Record<string, unknown> | undefined,
) {
  if (!incoming) {
    return previous ?? {};
  }

  return {
    ...(previous ?? {}),
    ...incoming,
  };
}

// Week 2: 갱신 필요 여부 판단
function shouldRefreshSnapshot(session: any): boolean {
  const now = new Date();
  const lastUpdate = new Date(session.updatedAt || session.startedAt);
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

  // 점검 진행 중이면 갱신 안함 (혼란 방지)
  if (session.status === 'active' && session.currentStep > 0) {
    return false;
  }

  // 최근 1시간 이내 갱신했으면 스킵
  if (hoursSinceUpdate < 1) {
    return false;
  }

  // draft 상태 + 12시간 경과 → 갱신
  if (session.status === 'draft' && hoursSinceUpdate >= 12) {
    return true;
  }

  // 24시간 경과 → 갱신
  if (hoursSinceUpdate >= 24) {
    return true;
  }

  return false;
}

// Week 2: 백그라운드 갱신 함수 (상태 추적)
async function refreshSnapshotInBackground(
  sessionId: string,
  equipmentSerial: string
): Promise<void> {
  try {
    // aed_data에서 최신 데이터 조회
    const latestData = await prisma.aedData.findUnique({
      where: { equipmentSerial: equipmentSerial }
    });

    if (!latestData) {
      throw new Error(`Failed to fetch aed_data for ${equipmentSerial}`);
    }

    // Week 2: 듀얼 쓰기 (양쪽 모두 업데이트)
    await prisma.inspectionSession.update({
      where: { id: sessionId },
      data: {
        deviceInfo: latestData as any,
        updatedAt: new Date()
      }
    });

    console.log(`Snapshot refreshed successfully for session ${sessionId}`);
  } catch (err) {
    console.error(`Background refresh failed for session ${sessionId}:`, err);
    throw err;
  }
}

export const POST = async (request: NextRequest) => {
  const { userId } = await requireAuthWithRole();
  const payload = (await request.json()) as StartSessionPayload;

  if (!payload?.equipmentSerial) {
    return NextResponse.json(
      { error: 'equipmentSerial is required' },
      { status: 400 },
    );
  }

  // 현재 진행 중인 세션이 있는지 확인 (최신 것만)
  const activeSessions = await prisma.inspectionSession.findFirst({
    where: {
      inspectorId: userId,
      status: 'active'
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      equipmentSerial: true,
      createdAt: true,
      status: true,
      updatedAt: true,
      currentStep: true
    }
  });

  // 개선된 로직: active 세션이 있으면 자동으로 일시정지 후 새 세션 시작
  if (activeSessions) {
    console.log(`[Session Start] Auto-pausing existing active session ${activeSessions.id} for new inspection`);
    // 기존 세션을 자동으로 일시정지
    await prisma.inspectionSession.update({
      where: { id: activeSessions.id },
      data: {
        status: 'paused',
        pausedAt: new Date()
      }
    });
  }

  // Priority 1: Assignment 확인 및 연동
  const assignment = await prisma.inspectionAssignment.findFirst({
    where: {
      equipmentSerial: payload.equipmentSerial,
      assignedTo: userId,
      status: { in: ['pending', 'in_progress'] }
    },
    select: {
      id: true,
      equipmentSerial: true,
      assignedTo: true,
      status: true
    }
  });

  // 할당되지 않은 장비는 점검 불가
  if (!assignment) {
    console.log(`[Session Start] User ${userId} attempted to inspect unassigned equipment: ${payload.equipmentSerial}`);
    return NextResponse.json(
      {
        error: '이 장비는 귀하에게 할당되지 않았습니다. 관리자에게 문의하세요.',
        code: 'NOT_ASSIGNED'
      },
      { status: 403 },
    );
  }

  console.log(`[Session Start] Assignment found for user ${userId}, equipment ${payload.equipmentSerial}, assignment status: ${assignment.status}`);

  // Assignment 상태를 'in_progress'로 업데이트
  if (assignment.status === 'pending') {
    try {
      await prisma.inspectionAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'in_progress',
          startedAt: new Date()
        }
      });
      console.log(`[Session Start] Assignment ${assignment.id} status updated to 'in_progress'`);
    } catch (updateError) {
      console.error('[Session Start] Failed to update assignment status:', updateError);
      // 에러가 발생해도 세션 생성은 계속 진행 (중요하지 않은 업데이트)
    }
  }

  let deviceSnapshot = payload.deviceSnapshot ?? null;

  if (!deviceSnapshot) {
    // aed_data에서 직접 조회 (장비연번 기준)
    const device = await prisma.aedData.findUnique({
      where: { equipmentSerial: payload.equipmentSerial }
    });

    if (device) {
      console.log('Device data from aed_data:', device);
      deviceSnapshot = device as any;
    } else {
      console.log('No device found for equipment_serial:', payload.equipmentSerial);
    }
  }

  // Week 2: 듀얼 쓰기 (device_info와 snapshots 동시 저장)
  const data = await prisma.inspectionSession.create({
    data: {
      equipmentSerial: payload.equipmentSerial,
      inspectorId: userId,
      currentStep: 0,                       // 명시적으로 0부터 시작
      deviceInfo: deviceSnapshot as any,    // 하위 호환성
      status: 'active'
    }
  });

  // Week 2: 듀얼 읽기 (응답에 양쪽 모두 포함)
  const deviceData = data.deviceInfo;

  return NextResponse.json({
    session: {
      ...data,
      device_info: deviceData, // 하위 호환성
    }
  });
};

export const GET = async (request: NextRequest) => {
  const { userId } = await requireAuthWithRole();
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const status = request.nextUrl.searchParams.get('status');

  if (sessionId) {
    // 1️⃣ 세션 즉시 조회 및 반환 (~50ms)
    const data = await prisma.inspectionSession.findUnique({
      where: { id: sessionId }
    });

    if (!data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (data.inspectorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Week 2: 듀얼 읽기 (deviceInfo 사용)
    const deviceData = data.deviceInfo;

    // 2️⃣ 업데이트 (비차단)
    prisma.inspectionSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    })
      .then(() => console.log(`Last accessed updated for ${sessionId}`))
      .catch(err => console.error('Failed to update last_accessed:', err));

    // Priority 2: 소프트 타임아웃 경고 (자동 처리 없음)
    const now = new Date();
    const lastAccess = new Date(data.updatedAt || data.startedAt);
    const hoursSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);

    let warning = null;
    if (hoursSinceAccess > 24 && data.status === 'active') {
      warning = {
        type: 'stale_session',
        message: '24시간 이상 접근하지 않은 세션입니다. 계속 진행하시겠습니까?',
        hoursSinceAccess: Math.floor(hoursSinceAccess),
        suggestAction: 'resume_or_cancel',
        severity: 'high'
      };
      console.warn(`[Session Warning] Stale session detected: ${sessionId}, ${hoursSinceAccess.toFixed(1)} hours since last access`);
    } else if (hoursSinceAccess > 4 && data.status === 'active') {
      warning = {
        type: 'inactive_session',
        message: '4시간 이상 접근하지 않았습니다. 점검을 계속 진행하세요.',
        hoursSinceAccess: Math.floor(hoursSinceAccess),
        severity: 'medium'
      };
      console.info(`[Session Info] Inactive session: ${sessionId}, ${hoursSinceAccess.toFixed(1)} hours since last access`);
    }

    // 3️⃣ 갱신 필요 여부 체크 (빠름, ~1ms)
    const needsRefresh = shouldRefreshSnapshot(data);

    // 4️⃣ 중복 갱신 확인
    const isAlreadyRefreshing = refreshingSessionsCache.has(sessionId);

    // 6️⃣ 백그라운드 갱신 (응답 차단 안함)
    if (needsRefresh && !isAlreadyRefreshing) {
      // 캐시에 등록
      refreshingSessionsCache.set(sessionId, true);
      refreshStartTimes.set(sessionId, Date.now());

      // Promise를 await 하지 않고 fire-and-forget
      refreshSnapshotInBackground(sessionId, data.equipmentSerial)
        .catch(err => {
          console.error('Background refresh failed:', err);
        })
        .finally(() => {
          // 완료 후 캐시에서 제거
          refreshingSessionsCache.delete(sessionId);
          refreshStartTimes.delete(sessionId);
        });
    }

    // 7️⃣ 현재 데이터 즉시 반환 + 갱신 상태 플래그 + 타임아웃 경고
    return NextResponse.json({
      session: {
        ...data,
        device_info: deviceData, // 하위 호환성
      },
      refreshing: needsRefresh && !isAlreadyRefreshing,
      warning, // Priority 2: 타임아웃 경고 (null 또는 경고 객체)
    });
  }

  const where: any = {
    inspectorId: userId
  };

  if (status) {
    where.status = status;
  }

  const data = await prisma.inspectionSession.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  return NextResponse.json({ sessions: data ?? [] });
};

// 필드별 검증 함수
function validateStepData(stepData: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // basicInfo 검증
  if (stepData.basicInfo) {
    const basicInfo = stepData.basicInfo as Record<string, any>;

    if (basicInfo.all_matched === 'edited') {
      if (basicInfo.manager && typeof basicInfo.manager === 'string' && basicInfo.manager.trim().length === 0) {
        errors.push('기본정보: 관리책임자 값이 비어있음');
      }
      if (basicInfo.contact_info && typeof basicInfo.contact_info === 'string' && basicInfo.contact_info.trim().length === 0) {
        errors.push('기본정보: 담당자 연락처 값이 비어있음');
      }
    }

    if (basicInfo.location_matched === 'edited') {
      if (basicInfo.address && typeof basicInfo.address === 'string' && basicInfo.address.trim().length === 0) {
        errors.push('기본정보: 주소 값이 비어있음');
      }
    }
  }

  // deviceInfo 검증
  if (stepData.deviceInfo) {
    const deviceInfo = stepData.deviceInfo as Record<string, any>;

    // all_matched 상태 검증
    if (deviceInfo.all_matched === true || deviceInfo.all_matched === 'edited') {
      if (!deviceInfo.manufacturer || (typeof deviceInfo.manufacturer === 'string' && deviceInfo.manufacturer.trim().length === 0)) {
        errors.push('장비정보: 제조사 값이 비어있음');
      }
      if (!deviceInfo.model_name || (typeof deviceInfo.model_name === 'string' && deviceInfo.model_name.trim().length === 0)) {
        errors.push('장비정보: 모델명 값이 비어있음');
      }
      if (!deviceInfo.serial_number || (typeof deviceInfo.serial_number === 'string' && deviceInfo.serial_number.trim().length === 0)) {
        errors.push('장비정보: 제조번호 값이 비어있음');
      }
    }

    // 소모품 개별 _matched 플래그 검증
    const batteryMatched = deviceInfo.battery_expiry_date_matched;
    if (batteryMatched === 'edited' && (!deviceInfo.battery_expiry_date || (typeof deviceInfo.battery_expiry_date === 'string' && deviceInfo.battery_expiry_date.trim().length === 0))) {
      errors.push('소모품: 배터리 유효기간 값이 비어있음');
    }

    const padMatched = deviceInfo.pad_expiry_date_matched;
    if (padMatched === 'edited' && (!deviceInfo.pad_expiry_date || (typeof deviceInfo.pad_expiry_date === 'string' && deviceInfo.pad_expiry_date.trim().length === 0))) {
      errors.push('소모품: 패드 유효기간 값이 비어있음');
    }

    const mfgDateMatched = deviceInfo.manufacturing_date_matched;
    if (mfgDateMatched === 'edited' && (!deviceInfo.manufacturing_date || (typeof deviceInfo.manufacturing_date === 'string' && deviceInfo.manufacturing_date.trim().length === 0))) {
      errors.push('소모품: 제조일자 값이 비어있음');
    }
  }

  // storage 검증
  if (stepData.storage) {
    const storage = stepData.storage as Record<string, any>;

    if (!storage.storage_type) {
      errors.push('보관함: 보관함 형태가 선택되지 않음');
    } else if (storage.storage_type !== 'none') {
      const checklistItems = storage.checklist_items || {};
      const checklistKeys = Object.keys(checklistItems);

      if (checklistKeys.length === 0) {
        errors.push('보관함: 체크리스트 항목이 입력되지 않음');
      } else {
        const unansweredItems = checklistKeys.filter(key => {
          const value = checklistItems[key];
          return value === undefined || value === null || value === '';
        });

        if (unansweredItems.length > 0) {
          errors.push(`보관함: ${unansweredItems.length}개의 미응답 체크리스트 항목`);
        }
      }

      const signageSelected = storage.signage_selected || [];
      if (!Array.isArray(signageSelected) || signageSelected.length === 0) {
        errors.push('보관함: 안내표지가 선택되지 않음');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const PATCH = async (request: NextRequest) => {
  const { userId } = await requireAuthWithRole();
  const payload = (await request.json()) as UpdateSessionPayload;

  if (!payload?.sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 },
    );
  }

  const session = await prisma.inspectionSession.findUnique({
    where: { id: payload.sessionId }
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.inspectorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 필드별 검증
  if (payload.stepData) {
    const validation = validateStepData(payload.stepData);
    if (!validation.valid) {
      console.warn('[Validation Error] Step data validation failed:', {
        sessionId: payload.sessionId,
        currentStep: payload.currentStep,
        errors: validation.errors,
      });
      return NextResponse.json(
        {
          error: '필드 검증 실패',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
          message: `입력 데이터 오류: ${validation.errors.join(' | ')}`,
        },
        { status: 400 },
      );
    }
  }

  const mergedStepData = mergeStepData(
    (session.stepData as Record<string, unknown> | null) ?? {},
    payload.stepData,
  );

  const updates: any = {
    stepData: mergedStepData,
  };

  if (typeof payload.currentStep === 'number') {
    updates.currentStep = payload.currentStep;
  }

  if (payload.status && payload.status !== session.status) {
    updates.status = payload.status;
    if (payload.status === 'paused') {
      updates.pausedAt = new Date();
    }
    if (payload.status === 'active') {
      updates.resumedAt = new Date();
    }
    if (payload.status === 'cancelled') {
      updates.cancelledAt = new Date();
    }
  }

  if (payload.notes !== undefined) {
    updates.notes = payload.notes;
  }

  if (payload.status === 'completed' || payload.finalizeData) {
    const finalData = mergeStepData(mergedStepData, payload.finalizeData);

    // 점검 완료 데이터 검증
    console.log('[Session Complete] finalData structure:', {
      keys: Object.keys(finalData),
      basicInfoKeys: finalData.basicInfo ? Object.keys(finalData.basicInfo) : 'N/A',
      deviceInfoKeys: finalData.deviceInfo ? Object.keys(finalData.deviceInfo) : 'N/A',
    });

    // RPC 대신 Prisma 트랜잭션으로 완료 처리
    try {
      const completedSession = await prisma.$transaction(async (tx) => {
        // 1. 세션 완료 업데이트
        const updated = await tx.inspectionSession.update({
          where: { id: payload.sessionId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            stepData: finalData as any,
            updatedAt: new Date()
          }
        });

        // 2. inspection 레코드 생성 (finalData에서 추출)
        const basicInfo = finalData.basicInfo as any || {};
        const deviceInfo = finalData.deviceInfo as any || {};
        const storage = finalData.storage as any || {};

        await tx.inspection.create({
          data: {
            equipmentSerial: session.equipmentSerial,
            inspectorId: userId,
            inspectionDate: new Date(),
            inspectionType: 'monthly',
            // 기본 정보
            confirmedLocation: basicInfo.address,
            // 장비 정보
            confirmedManufacturer: deviceInfo.manufacturer,
            confirmedModelName: deviceInfo.model_name,
            confirmedSerialNumber: deviceInfo.serial_number,
            // 소모품
            batteryStatus: deviceInfo.battery_status || 'not_checked',
            batteryExpiryChecked: deviceInfo.battery_expiry_date ? new Date(deviceInfo.battery_expiry_date) : null,
            padStatus: deviceInfo.pad_status || 'not_checked',
            padExpiryChecked: deviceInfo.pad_expiry_date ? new Date(deviceInfo.pad_expiry_date) : null,
            // 전체 상태
            overallStatus: (finalData.overallStatus as any) || 'pass',
            notes: payload.notes
          }
        });

        return updated;
      });

      // 점검 완료 시 해당 장비의 assignment도 completed로 변경
      if (session.equipmentSerial) {
        await prisma.inspectionAssignment.updateMany({
          where: {
            equipmentSerial: session.equipmentSerial,
            assignedTo: userId,
            status: { in: ['pending', 'in_progress'] }
          },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });
      }

      return NextResponse.json({ session: completedSession });
    } catch (rpcError: any) {
      console.error('[Session Complete] Error:', rpcError);
      return NextResponse.json(
        {
          error: '점검 완료 처리 중 오류가 발생했습니다.',
          details: rpcError.message,
        },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.inspectionSession.update({
    where: { id: payload.sessionId },
    data: updates
  });

  return NextResponse.json({ session: updated });
};

// 세션 취소 (DELETE): 데이터 삭제 없이 상태만 cancelled로 변경
export const DELETE = async (request: NextRequest) => {
  const { userId } = await requireAuthWithRole();
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 },
    );
  }

  // 세션 조회 및 권한 확인
  const session = await prisma.inspectionSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      inspectorId: true,
      equipmentSerial: true,
      status: true
    }
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.inspectorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 이미 완료되거나 취소된 세션은 취소 불가
  if (session.status === 'completed') {
    return NextResponse.json(
      { error: '완료된 세션은 취소할 수 없습니다.' },
      { status: 400 },
    );
  }

  if (session.status === 'cancelled') {
    return NextResponse.json(
      { error: '이미 취소된 세션입니다.' },
      { status: 400 },
    );
  }

  // 안전한 취소: 데이터 삭제 없이 상태만 변경
  const cancelled = await prisma.inspectionSession.update({
    where: { id: sessionId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date()
    }
  });

  // 연관된 assignment도 취소 처리
  if (session.equipmentSerial) {
    await prisma.inspectionAssignment.updateMany({
      where: {
        equipmentSerial: session.equipmentSerial,
        assignedTo: userId,
        status: 'in_progress'
      },
      data: {
        status: 'pending', // 다시 pending으로 변경하여 재할당 가능하게
        startedAt: null,   // 시작 시간 초기화
      }
    });
  }

  return NextResponse.json({
    session: cancelled,
    message: '점검 세션이 취소되었습니다. 모든 데이터는 보관되었습니다.',
  });
};
