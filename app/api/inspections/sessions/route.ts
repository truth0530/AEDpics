import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const equipmentSerial = searchParams.get('equipmentSerial');
    const statusParam = searchParams.get('status');

    // Case 1: 특정 장비의 세션 조회 (equipmentSerial 제공)
    if (equipmentSerial) {
      const where: any = {
        equipment_serial: equipmentSerial
      };

      if (statusParam) {
        where.status = statusParam;
      }

      const session_record = await prisma.inspection_sessions.findFirst({
        where,
        include: {
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        },
        orderBy: {
          started_at: 'desc'
        }
      });

      return NextResponse.json({
        success: true,
        data: session_record
      });
    }

    // Case 2: 모든 활성 세션 조회 (equipmentSerial 미제공)
    // statusParam이 'active'이면 완료되지 않은 세션만, 없으면 모든 세션 반환
    const where: any = {};
    if (statusParam === 'active') {
      where.status = {
        in: ['active', 'paused'] // 완료/취소/보류 제외
      };
    }

    const sessions = await prisma.inspection_sessions.findMany({
      where,
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        started_at: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      sessions: sessions
    });
  } catch (error) {
    console.error('[InspectionSessions:GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspections/sessions
 * 점검 세션 생성 또는 재개 (트랜잭션 기반 race condition 방지)
 *
 * 동작:
 * - 활성 세션 없음 → 새 세션 생성 (action: 'created')
 * - 자신의 활성 세션 있음 → 세션 재개 (action: 'resumed')
 * - 다른 사람의 활성 세션 있음 → 차단 (409 Conflict)
 *
 * Race Condition 방지:
 * - Application Level: 트랜잭션 기반 원자적 검증 및 생성/재개
 * - Database Level: Partial Unique Index (equipment_serial + status IN ('active', 'paused'))
 * - 이중 방어 구현으로 완전한 race condition 방지
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { equipment_serial } = body;

  if (!equipment_serial) {
    return NextResponse.json(
      { error: 'equipment_serial is required' },
      { status: 400 }
    );
  }

  try {
    // 트랜잭션 내에서 세션 생성 또는 재개 (Race Condition 방지)
    // - 트랜잭션 내에서 원자적으로 검증 및 작업 수행
    // - 두 개의 동시 요청이 모두 "no active session"을 보고 create할 수 없음
    // - Database-level Partial Unique Index가 마지막 방어선 역할
    const result = await prisma.$transaction(async (tx) => {
      // STEP 0: 장비 데이터 조회 (세션 생성 전 필요)
      const deviceData = await tx.aed_data.findUnique({
        where: { equipment_serial }
      });

      if (!deviceData) {
        throw new Error(`NO_DEVICE|장비 정보를 찾을 수 없습니다. (Serial: ${equipment_serial})`);
      }

      // STEP 1: 트랜잭션 내에서 현재 상태 확인
      const existingSession = await tx.inspection_sessions.findFirst({
        where: {
          equipment_serial,
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
        }
      });

      // STEP 2: 활성 세션 존재 여부에 따른 처리
      if (existingSession) {
        // 활성 세션이 존재함
        const isOwnSession = existingSession.inspector_id === session.user.id;

        if (isOwnSession) {
          // 자신의 세션 → 재개 (최신 장비 데이터로 스냅샷 업데이트)
          const resumedSession = await tx.inspection_sessions.update({
            where: { id: existingSession.id },
            data: {
              status: 'active',
              resumed_at: new Date()
            },
            include: {
              user_profiles: {
                select: {
                  id: true,
                  full_name: true,
                  email: true
                }
              }
            }
          });

          return {
            sessionData: resumedSession,
            action: 'resumed',
            message: '기존 점검 세션을 재개합니다.',
            shouldContinue: true
          };
        } else {
          // 다른 사람의 세션 → 차단 (에러 발생)
          throw new Error(
            `BLOCKED|다른 점검자가 이미 점검 중입니다 (점검자: ${existingSession.user_profiles?.full_name || '알 수 없음'}, 시작: ${existingSession.started_at.toISOString()})|${existingSession.id}`
          );
        }
      }

      // STEP 3: 활성 세션 없음 → 새 세션 생성
      const newSession = await tx.inspection_sessions.create({
        data: {
          equipment_serial,
          inspector_id: session.user.id,
          status: 'active',
          current_step: 0,
          current_snapshot: deviceData as any, // 장비 데이터 스냅샷 저장
          started_at: new Date()
        },
        include: {
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        }
      });

      return {
        sessionData: newSession,
        action: 'created',
        message: '새로운 점검 세션이 생성되었습니다.',
        shouldContinue: true
      };
    });

    logger.info('InspectionSessions:POST', `Session ${result.action}`, {
      sessionId: result.sessionData.id,
      equipmentSerial: equipment_serial,
      userId: session.user.id,
      action: result.action,
      message: result.message
    });

    return NextResponse.json({
      success: true,
      session: result.sessionData,
      action: result.action,
      message: result.message
    });
  } catch (error: any) {
    // 장비 정보 없음 에러
    if (error instanceof Error && error.message.startsWith('NO_DEVICE|')) {
      const parts = error.message.split('|');
      const reason = parts[1] || '장비 정보를 찾을 수 없습니다';

      logger.error('InspectionSessions:POST', 'Device not found', {
        equipmentSerial: equipment_serial,
        userId: session.user.id,
        reason
      });

      return NextResponse.json(
        {
          success: false,
          error: reason
        },
        { status: 404 } // Not Found: 장비 정보 없음
      );
    }

    // Race Condition 감지: 다른 사용자의 활성 세션 존재
    if (error instanceof Error && error.message.startsWith('BLOCKED|')) {
      const parts = error.message.split('|');
      const reason = parts[1] || '다른 점검자가 이미 점검 중입니다';
      const sessionId = parts[2];

      logger.warn('InspectionSessions:POST', 'Session creation blocked - other user session active', {
        equipmentSerial: equipment_serial,
        userId: session.user.id,
        reason
      });

      return NextResponse.json(
        {
          success: false,
          error: reason,
          existingSessionId: sessionId
        },
        { status: 409 } // Conflict: 다른 사용자의 활성 세션 존재
      );
    }

    // 기타 에러 처리
    logger.error('InspectionSessions:POST', 'Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inspections/sessions
 * 점검 세션 진행 상황 저장
 *
 * 동작:
 * - 세션 소유자만 업데이트 가능
 * - current_step, step_data, field_changes, status 업데이트
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, currentStep, stepData, fieldChanges, status, notes, finalizeData, action } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // 세션 조회 및 권한 확인
    const existingSession = await prisma.inspection_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: '점검 세션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 세션 소유자 확인
    if (existingSession.inspector_id !== session.user.id) {
      return NextResponse.json(
        { error: '다른 사용자의 점검 세션은 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 세션 일시정지 처리
    if (action === 'pause') {
      const pausedSession = await prisma.inspection_sessions.update({
        where: { id: sessionId },
        data: {
          status: 'paused',
          paused_at: new Date(),
          updated_at: new Date()
        },
        include: {
          user_profiles: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        }
      });

      logger.info('InspectionSessions:PATCH', 'Session paused', {
        sessionId,
        userId: session.user.id
      });

      return NextResponse.json({
        success: true,
        session: pausedSession,
        message: '점검 세션이 일시정지되었습니다.'
      });
    }

    // 점검 완료 처리 (트랜잭션)
    if (status === 'completed') {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. 세션 업데이트
          const updatedSession = await tx.inspection_sessions.update({
            where: { id: sessionId },
            data: {
              status: 'completed',
              completed_at: new Date(),
              current_step: currentStep !== undefined ? currentStep : existingSession.current_step,
              step_data: stepData !== undefined ? stepData : existingSession.step_data,
              field_changes: fieldChanges !== undefined ? fieldChanges : existingSession.field_changes,
              updated_at: new Date(),
            },
            include: {
              user_profiles: {
                select: {
                  id: true,
                  full_name: true,
                  email: true,
                },
              },
            },
          });

          // 2. inspections 테이블에 레코드 생성
          const mergedStepData = stepData || existingSession.step_data || {};
          const deviceInfo = (mergedStepData as any).deviceInfo || {};
          const basicInfo = (mergedStepData as any).basicInfo || {};
          const storage = (mergedStepData as any).storage || {};

          // aed_data FK 조회
          let aedDataId: number | null = null;
          try {
            const aedData = await tx.aed_data.findUnique({
              where: { equipment_serial: existingSession.equipment_serial },
              select: { id: true },
            });
            if (aedData) {
              aedDataId = aedData.id;
            }
          } catch (aedLookupError) {
            logger.warn('InspectionSessions:PATCH', 'Failed to lookup aed_data', {
              equipment_serial: existingSession.equipment_serial,
              error: aedLookupError instanceof Error ? aedLookupError.message : 'Unknown error',
            });
          }

          // issues_found 배열 생성
          const issuesFound: string[] = [];
          if (deviceInfo.battery_expiry_date_matched === false) {
            issuesFound.push('배터리 유효기간 불일치');
          }
          if (deviceInfo.pad_expiry_date_matched === false) {
            issuesFound.push('패드 유효기간 불일치');
          }
          if (storage.checklist_items) {
            Object.entries(storage.checklist_items).forEach(([key, value]) => {
              if (value === 'bad' || value === 'needs_improvement') {
                issuesFound.push(`보관함 ${key} 개선 필요`);
              }
            });
          }

          // photos 배열 생성
          const photos: string[] = [];
          if (deviceInfo.serial_number_photo) photos.push(deviceInfo.serial_number_photo);
          if (deviceInfo.battery_mfg_date_photo) photos.push(deviceInfo.battery_mfg_date_photo);
          if (storage.storage_box_photo) photos.push(storage.storage_box_photo);

          const createData: any = {
            equipment_serial: existingSession.equipment_serial,
            inspection_date: new Date(),
            inspection_type: 'monthly',
            battery_status: deviceInfo.battery_expiry_date_matched === true ? 'good' :
                          deviceInfo.battery_expiry_date_matched === 'edited' ? 'replaced' : 'not_checked',
            pad_status: deviceInfo.pad_expiry_date_matched === true ? 'good' :
                       deviceInfo.pad_expiry_date_matched === 'edited' ? 'replaced' : 'not_checked',
            overall_status: 'pass',
            notes: notes || null,
            issues_found: issuesFound,
            photos: photos,
            original_data: existingSession.current_snapshot || {},
            inspected_data: {
              basicInfo: basicInfo,
              deviceInfo: deviceInfo,
              storage: storage,
              confirmedLocation: basicInfo.address,
              confirmedManufacturer: deviceInfo.manufacturer,
              confirmedModelName: deviceInfo.model_name,
              confirmedSerialNumber: deviceInfo.serial_number,
              batteryExpiryChecked: deviceInfo.battery_expiry_date,
              padExpiryChecked: deviceInfo.pad_expiry_date,
            },
            // Relations
            user_profiles: { connect: { id: session.user.id } },
          };

          // aed_data FK 연결
          if (aedDataId) {
            createData.aed_data = { connect: { id: aedDataId } };
          }

          const createdInspection = await tx.inspections.create({
            data: createData,
          });

          logger.info('InspectionSessions:PATCH', 'Inspection record created', {
            inspectionId: createdInspection.id,
            equipment_serial: existingSession.equipment_serial,
            sessionId: sessionId,
          });

          // 3. aed_data.last_inspection_date 업데이트
          if (aedDataId) {
            try {
              await tx.aed_data.update({
                where: { equipment_serial: existingSession.equipment_serial },
                data: { last_inspection_date: new Date() },
              });
            } catch (updateError) {
              logger.warn('InspectionSessions:PATCH', 'Failed to update last_inspection_date', {
                equipment_serial: existingSession.equipment_serial,
                error: updateError instanceof Error ? updateError.message : 'Unknown error',
              });
            }
          }

          // 4. inspection_assignments 상태 업데이트 (있다면)
          // pending 또는 in_progress 상태의 assignment를 모두 completed로 업데이트
          try {
            await tx.inspection_assignments.updateMany({
              where: {
                equipment_serial: existingSession.equipment_serial,
                status: { in: ['pending', 'in_progress'] },
              },
              data: {
                status: 'completed',
                completed_at: new Date(),
              },
            });
          } catch (assignmentError) {
            logger.warn('InspectionSessions:PATCH', 'Failed to update assignment status', {
              equipment_serial: existingSession.equipment_serial,
              error: assignmentError instanceof Error ? assignmentError.message : 'Unknown error',
            });
          }

          return {
            session: updatedSession,
            inspection: createdInspection
          };
        });

        logger.info('InspectionSessions:PATCH', 'Session completed successfully', {
          sessionId: sessionId,
          inspectionId: result.inspection.id,
          userId: session.user.id,
        });

        return NextResponse.json({
          success: true,
          session: result.session,
          inspection: result.inspection,
        });
      } catch (transactionError) {
        logger.error('InspectionSessions:PATCH', 'Transaction failed during completion', {
          error: transactionError instanceof Error ? transactionError.message : 'Unknown error',
          sessionId: sessionId,
        });
        return NextResponse.json(
          { error: '점검 완료 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    // 일반 업데이트 (완료가 아닌 경우)
    const updateData: any = {
      updated_at: new Date(),
    };

    if (currentStep !== undefined) {
      updateData.current_step = currentStep;
    }

    if (stepData !== undefined) {
      updateData.step_data = stepData;
    }

    if (fieldChanges !== undefined) {
      updateData.field_changes = fieldChanges;
    }

    if (status !== undefined && status !== 'completed') {
      updateData.status = status;
    }

    // notes는 inspection_sessions 테이블에 없을 수 있으므로 로그로만 기록
    if (notes !== undefined) {
      logger.info('InspectionSessions:PATCH', 'Notes provided', {
        sessionId,
        notes: typeof notes === 'string' ? notes.substring(0, 100) : notes,
      });
    }

    // 세션 업데이트
    const updatedSession = await prisma.inspection_sessions.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    logger.info('InspectionSessions:PATCH', 'Session updated successfully', {
      sessionId: updatedSession.id,
      currentStep: updatedSession.current_step,
      status: updatedSession.status,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      session: updatedSession,
    });
  } catch (error: any) {
    logger.error('InspectionSessions:PATCH', 'Unexpected error', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
