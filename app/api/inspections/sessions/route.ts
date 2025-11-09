import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { canPerformInspection, AccessContext } from '@/lib/auth/access-control';
import { LRUCache } from 'lru-cache';
import { logger } from '@/lib/logger';
import { analyzeInspectionFields } from '@/lib/inspections/field-comparison';
import { prisma } from '@/lib/prisma';

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
  equipment_serial?: string;
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

function removeUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map(item => removeUndefinedValues(item))
      .filter(item => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      if (val === undefined) {
        return;
      }
      result[key] = removeUndefinedValues(val);
    });
    return result as T;
  }

  return value;
}

async function requireAuthWithRole() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 };
  }

  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      organization_id: true,
      organization_name: true,
      organizations: {
        select: {
          id: true,
          name: true,
          type: true,
          city_code: true,
          region_code: true,
        }
      }
    }
  });

  if (!profile) {
    return { error: 'User not found', status: 404 };
  }

  const accessContext: AccessContext = {
    userId: profile.id,
    role: profile.role,
    organizationId: profile.organization_id || undefined,
    accountType: 'public',  // default value
  };

  return { profile, accessContext, userId: session.user.id };
}

const SESSION_STATUS_VALUES = ['active', 'paused', 'completed', 'cancelled'] as const;
type SessionStatus = typeof SESSION_STATUS_VALUES[number];
const DEFAULT_ACTIVE_STATUSES: SessionStatus[] = ['active', 'paused'];

function isSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUS_VALUES as readonly string[]).includes(value);
}

// HTTP 메소드 핸들러들을 export로 변경
export async function GET(request: NextRequest) {
  const auth = await requireAuthWithRole();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const statusParam = searchParams.get('status');

    if (sessionId) {
      const session = await prisma.inspection_sessions.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return NextResponse.json(
          { error: '세션을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      if (session.inspector_id !== userId) {
        return NextResponse.json(
          { error: '권한이 없습니다.' },
          { status: 403 }
        );
      }

      return NextResponse.json({ session });
    }

    const normalizedStatuses = statusParam
      ? statusParam
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter((value): value is SessionStatus => isSessionStatus(value))
      : [];

    const isAllStatusesRequested = statusParam?.toLowerCase() === 'all';
    const statusFilter = isAllStatusesRequested
      ? undefined
      : normalizedStatuses.length > 0
        ? normalizedStatuses
        : undefined;

    const statusesToQuery = statusFilter ?? (!statusParam ? DEFAULT_ACTIVE_STATUSES : undefined);

    // 활성 세션들 조회 (필터 적용)
    const sessions = await prisma.inspection_sessions.findMany({
      where: {
        inspector_id: userId,
        ...(statusesToQuery ? { status: { in: statusesToQuery } } : {}),
      },
      orderBy: { updated_at: 'desc' }
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error('InspectionSession:GET', 'Failed to fetch sessions', { error, userId });
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithRole();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profile, accessContext, userId } = auth;

  try {
    const payload: StartSessionPayload = await request.json();

    if (!payload.equipment_serial) {
      return NextResponse.json(
        { error: '장비 시리얼 번호가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미 활성 세션이 있는지 확인
    const activeSessions = await prisma.inspection_sessions.findFirst({
      where: {
        inspector_id: userId,
        equipment_serial: payload.equipment_serial,
        status: 'active'
      }
    });

    if (activeSessions) {
      // 기존 세션 반환
      return NextResponse.json({ session: activeSessions });
    }

    // Assignment 확인
    const assignment = await prisma.inspection_assignments.findFirst({
      where: {
        equipment_serial: payload.equipment_serial,
        assigned_to: userId,
        status: { in: ['pending', 'in_progress'] }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '이 장비는 귀하에게 할당되지 않았습니다.' },
        { status: 403 }
      );
    }

    // 장비 데이터 조회
    const deviceData = await prisma.aed_data.findUnique({
      where: { equipment_serial: payload.equipment_serial }
    });

    if (!deviceData) {
      return NextResponse.json(
        { error: '장비 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 새 세션 생성
    const newSession = await prisma.inspection_sessions.create({
      data: {
        equipment_serial: payload.equipment_serial,
        inspector_id: userId,
        status: 'active',
        current_step: 0,
        step_data: {},
        device_info: deviceData,
        started_at: new Date()
      }
    });

    // Assignment 상태 업데이트
    await prisma.inspection_assignments.update({
      where: { id: assignment.id },
      data: {
        status: 'in_progress',
        started_at: new Date()
      }
    });

    return NextResponse.json({ session: newSession });
  } catch (error) {
    logger.error('InspectionSession:POST', 'Failed to create session', { error, userId });
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthWithRole();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = auth;

  try {
    const payload: UpdateSessionPayload = await request.json();

    if (!payload.sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 조회
    const session = await prisma.inspection_sessions.findUnique({
      where: { id: payload.sessionId }
    });

    if (!session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (session.inspector_id !== userId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 완료 처리
    if (payload.status === 'completed' && payload.finalizeData) {
      const { finalizeData } = payload;

      // 데이터 검증 및 로깅
      console.log('[PATCH Complete] Received finalizeData:', JSON.stringify({
        hasDeviceInfo: !!finalizeData.deviceInfo,
        hasBasicInfo: !!finalizeData.basicInfo,
        hasStorage: !!finalizeData.storage,
        deviceInfoKeys: finalizeData.deviceInfo ? Object.keys(finalizeData.deviceInfo) : [],
        basicInfoKeys: finalizeData.basicInfo ? Object.keys(finalizeData.basicInfo) : [],
        storageKeys: finalizeData.storage ? Object.keys(finalizeData.storage) : [],
      }, null, 2));

      // 트랜잭션으로 처리
      const result = await prisma.$transaction(async (tx) => {
        try {
          // 점검 데이터 생성
          const deviceInfo = (finalizeData.deviceInfo || {}) as any;
          const basicInfo = (finalizeData.basicInfo || {}) as any;
          const storage = (finalizeData.storage || {}) as any;

          // issues_found 배열 생성
          const issuesFound: string[] = [];
          if (!deviceInfo.all_matched) {
            issuesFound.push('장비 정보 불일치');
          }
          if (!basicInfo.all_matched) {
            issuesFound.push('기본 정보 불일치');
          }
          if (storage.checklist_items) {
            Object.entries(storage.checklist_items).forEach(([key, value]) => {
              if (value === 'bad' || value === 'needs_improvement') {
                issuesFound.push(`보관함 ${key} 개선 필요`);
              }
            });
          }

          // 사진 배열 생성
          const photos: string[] = [];
          if (deviceInfo.serial_number_photo) photos.push(deviceInfo.serial_number_photo);
          if (deviceInfo.battery_mfg_date_photo) photos.push(deviceInfo.battery_mfg_date_photo);
          if (storage.storage_box_photo) photos.push(storage.storage_box_photo);

          // aed_data FK 조회 (필수)
          const aedData = await tx.aed_data.findUnique({
            where: { equipment_serial: session.equipment_serial },
            select: { id: true }
          });

          console.log('[PATCH Complete] aedData lookup result:', { found: !!aedData, id: aedData?.id, serial: session.equipment_serial });

          // FK 연결 필수 확인: equipment_serial이 aed_data에 없으면 즉시 실패
          if (!aedData) {
            const errorMsg = `[DATA_INTEGRITY_ERROR] Equipment ${session.equipment_serial} not registered in AED database. Cannot proceed with inspection completion.`;
            console.error('[PATCH Complete] FK connection failed:', errorMsg);
            throw new Error(errorMsg);
          }

          // 점검 레코드 생성
          const createData: any = {
            equipment_serial: session.equipment_serial,
            inspection_date: new Date(),
            inspection_type: 'monthly',
            battery_status: deviceInfo.battery_expiry_date_matched === true ? 'good' : 'replaced',
            pad_status: deviceInfo.pad_expiry_date_matched === true ? 'good' : 'replaced',
            overall_status: 'pass',
            notes: payload.notes ?? null,
            issues_found: issuesFound,
            photos: photos,
            original_data: session.device_info || {},
            inspected_data: removeUndefinedValues({
              basicInfo: basicInfo,
              deviceInfo: deviceInfo,
              storage: storage,
              confirmedLocation: basicInfo.address,
              confirmedManufacturer: deviceInfo.manufacturer,
              confirmedModelName: deviceInfo.model_name,
              confirmedSerialNumber: deviceInfo.serial_number,
              batteryExpiryChecked: deviceInfo.battery_expiry_date,
              padExpiryChecked: deviceInfo.pad_expiry_date
            })
          };

          console.log('[PATCH Complete] createData prepared:', JSON.stringify({
            keys: Object.keys(createData),
            equipment_serial: createData.equipment_serial,
            inspection_type: createData.inspection_type,
            battery_status: createData.battery_status,
            pad_status: createData.pad_status,
            overall_status: createData.overall_status,
            issuesCount: issuesFound.length,
            photosCount: photos.length,
            aedDataId: aedData.id,
            inspectedDataKeys: Object.keys(createData.inspected_data)
          }, null, 2));

          // 관계(Relation)를 통한 필드 연결
          createData.user_profiles = { connect: { id: userId } };
          console.log('[PATCH Complete] inspector relation added via user_profiles:', userId);

          // aed_data FK 연결 (필수 - 위에서 검증 완료)
          createData.aed_data = { connect: { id: aedData.id } };
          console.log('[PATCH Complete] aed_data connection established:', aedData.id);

          console.log('[PATCH Complete] About to call tx.inspections.create()...');
          const createdInspection = await tx.inspections.create({
            data: createData
          });
          console.log('[PATCH Complete] Inspection created successfully:', { id: createdInspection.id, serial: createdInspection.equipment_serial });

          // 세션 완료 처리
          const updatedSession = await tx.inspection_sessions.update({
            where: { id: payload.sessionId },
            data: {
              status: 'completed',
              completed_at: new Date(),
              step_data: finalizeData as any,
              field_changes: {} as any  // 임시로 빈 객체로 처리
            }
          });

          // Assignment 완료 처리
          if (session.equipment_serial) {
            await tx.inspection_assignments.updateMany({
              where: {
                equipment_serial: session.equipment_serial,
                assigned_to: userId,
                status: 'in_progress'
              },
              data: {
                status: 'completed',
                completed_at: new Date()
              }
            });
          }

          return { inspection: createdInspection, session: updatedSession };
        } catch (txError) {
          logger.error('InspectionSession:PATCH[TxInside]', 'Transaction internal error', {
            error: txError instanceof Error ? txError.message : String(txError),
            code: (txError as any)?.code,
            meta: (txError as any)?.meta,
            cause: (txError as any)?.cause,
            stack: txError instanceof Error ? txError.stack : undefined,
          });
          console.error('[PATCH Complete] Transaction error caught inside:', JSON.stringify({
            message: txError instanceof Error ? txError.message : String(txError),
            code: (txError as any)?.code,
            meta: (txError as any)?.meta,
            cause: (txError as any)?.cause,
          }, null, 2));
          throw txError;
        }
      }).catch(txError => {
        logger.error('InspectionSession:PATCH[TxCatch]', 'Transaction error in catch block', {
          error: txError instanceof Error ? txError.message : String(txError),
          code: (txError as any)?.code,
          meta: (txError as any)?.meta,
          cause: (txError as any)?.cause,
          stack: txError instanceof Error ? txError.stack : undefined,
        });
        console.error('[PATCH Complete] Transaction catch error:', JSON.stringify({
          message: txError instanceof Error ? txError.message : String(txError),
          code: (txError as any)?.code,
          meta: (txError as any)?.meta,
        }, null, 2));
        throw txError;
      });

      return NextResponse.json({
        message: '점검이 완료되었습니다.',
        ...result
      });
    }

    // 일반 업데이트
    const updateData: any = {};
    if (payload.currentStep !== undefined) updateData.current_step = payload.currentStep;
    if (payload.stepData !== undefined) updateData.step_data = payload.stepData;
    if (payload.status !== undefined) updateData.status = payload.status;
    updateData.updated_at = new Date();

    const updatedSession = await prisma.inspection_sessions.update({
      where: { id: payload.sessionId },
      data: updateData
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    // 에러 상세 정보 로깅
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDataIntegrityError = errorMessage.includes('[DATA_INTEGRITY_ERROR]');

    const errorDetails = {
      userId,
      message: errorMessage,
      code: (error as any)?.code,
      meta: (error as any)?.meta,
      stack: error instanceof Error ? error.stack : undefined,
      isDataIntegrityError,
    };

    console.error('[PATCH /api/inspections/sessions] Error Details:', JSON.stringify(errorDetails, null, 2));
    logger.error('InspectionSession:PATCH',
      isDataIntegrityError ? 'Data integrity error - equipment not found' : 'Failed to update session',
      errorDetails);

    // DATA_INTEGRITY_ERROR는 400 Bad Request (클라이언트 책임), 다른 에러는 500 Internal Server Error
    const statusCode = isDataIntegrityError ? 400 : 500;
    const responseError = isDataIntegrityError
      ? errorMessage.replace('[DATA_INTEGRITY_ERROR] ', '')  // 프론트엔드에 깔끔한 메시지만 전달
      : 'Failed to update session';

    return NextResponse.json(
      {
        error: responseError,
        type: isDataIntegrityError ? 'DATA_INTEGRITY_ERROR' : 'SYSTEM_ERROR',
        details: isDataIntegrityError ? undefined : {
          code: (error as any)?.code,
          message: error instanceof Error ? error.message : String(error),
        }
      },
      { status: statusCode }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthWithRole();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 조회
    const session = await prisma.inspection_sessions.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (session.inspector_id !== userId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 완료된 세션은 삭제 불가
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: '완료된 세션은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 세션 취소 처리 (삭제하지 않고 상태만 변경)
    const cancelled = await prisma.inspection_sessions.update({
      where: { id: sessionId },
      data: {
        status: 'cancelled',
        cancelled_at: new Date()
      }
    });

    // Assignment도 취소
    if (session.equipment_serial) {
      await prisma.inspection_assignments.updateMany({
        where: {
          equipment_serial: session.equipment_serial,
          assigned_to: userId,
          status: 'in_progress'
        },
        data: {
          status: 'pending',
          started_at: null
        }
      });
    }

    return NextResponse.json({
      session: cancelled,
      message: '점검 세션이 취소되었습니다.'
    });
  } catch (error) {
    logger.error('InspectionSession:DELETE', 'Failed to cancel session', { error, userId });
    return NextResponse.json(
      { error: 'Failed to cancel session' },
      { status: 500 }
    );
  }
}
