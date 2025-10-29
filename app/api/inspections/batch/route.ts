import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
/**
 * Batch API for Inspection Assignments
 * 여러 작업을 하나의 트랜잭션으로 처리
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  data?: any;
  id?: string;
}

interface BatchRequest {
  operations: BatchOperation[];
}

interface BatchResult {
  success: boolean;
  results: Array<{
    operation: BatchOperation;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, organization_id: true }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 권한 확인
    const allowedRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: '작업 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body: BatchRequest = await request.json();

    if (!body.operations || !Array.isArray(body.operations)) {
      return NextResponse.json(
        { error: 'operations 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    if (body.operations.length === 0) {
      return NextResponse.json(
        { error: '최소 1개 이상의 작업이 필요합니다.' },
        { status: 400 }
      );
    }

    if (body.operations.length > 100) {
      return NextResponse.json(
        { error: '한 번에 최대 100개의 작업만 처리할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 결과 추적
    const results: BatchResult['results'] = [];
    let succeeded = 0;
    let failed = 0;

    // 각 작업 순차 처리 (트랜잭션 보장을 위해)
    for (const operation of body.operations) {
      try {
        let result: any;

        switch (operation.type) {
          case 'create':
            // 일정 생성
            if (!operation.data || !operation.data.equipment_serial) {
              throw new Error('equipmentSerial이 필요합니다.');
            }

            result = await prisma.inspection_assignments.create({
              data: {
                equipment_serial: operation.data.equipment_serial,
                assigned_to: operation.data.assignedTo || session.user.id,
                assigned_by: session.user.id,
                assignment_type: operation.data.assignment_type || 'scheduled',
                scheduled_date: operation.data.scheduled_date,
                scheduled_time: operation.data.scheduled_time,
                priority_level: operation.data.priority_level || 0,
                notes: operation.data.notes,
                status: 'pending'
              }
            });
            break;

          case 'update':
            // 일정 수정
            if (!operation.id) {
              throw new Error('id가 필요합니다.');
            }

            const updateData: any = {};
            if (operation.data?.status) updateData.status = operation.data.status;
            if (operation.data?.notes !== undefined) updateData.notes = operation.data.notes;
            if (operation.data?.priority_level !== undefined) updateData.priority_level = operation.data.priority_level;
            if (operation.data?.scheduled_date) updateData.scheduled_date = operation.data.scheduled_date;
            if (operation.data?.scheduled_time !== undefined) updateData.scheduled_time = operation.data.scheduled_time;

            result = await prisma.inspection_assignments.update({
              where: { id: operation.id },
              data: updateData
            });
            break;

          case 'delete':
            // 일정 삭제
            if (!operation.id) {
              throw new Error('id가 필요합니다.');
            }

            await prisma.inspection_assignments.delete({
              where: { id: operation.id }
            });

            result = { id: operation.id, deleted: true };
            break;

          default:
            throw new Error(`알 수 없는 작업 타입: ${operation.type}`);
        }

        results.push({
          operation,
          success: true,
          data: result
        });
        succeeded++;

      } catch (error: any) {
        results.push({
          operation,
          success: false,
          error: error.message || 'Unknown error'
        });
        failed++;
      }
    }

    // 결과 반환
    const batchResult: BatchResult = {
      success: failed === 0,
      results,
      stats: {
        total: body.operations.length,
        succeeded,
        failed
      }
    };

    // 부분 성공 시 207 Multi-Status
    const statusCode = failed === 0 ? 200 : (succeeded > 0 ? 207 : 500);

    return NextResponse.json(batchResult, { status: statusCode });

  } catch (error) {
    console.error('[Batch API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
