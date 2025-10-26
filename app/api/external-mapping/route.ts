import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * GET /api/external-mapping
 * 외부 시스템 매칭 목록 조회
 *
 * Query Parameters:
 * - matching_method: 매칭 방법 필터 (manual, auto)
 * - equipment_serial: 장비 시리얼 번호 검색
 * - external_system_name: 외부 시스템 이름 필터
 * - verified: 검증 상태 필터 (true, false)
 * - limit: 페이지당 항목 수 (기본값: 50)
 * - offset: 오프셋 (기본값: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile || !checkPermission(userProfile.role, 'VIEW_EXTERNAL_MAPPING')) {
      return NextResponse.json(
        { error: getPermissionError('VIEW_EXTERNAL_MAPPING') },
        { status: 403 }
      );
    }

    // 3. Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams;
    const matchingMethod = searchParams.get('matching_method');
    const equipmentSerial = searchParams.get('equipment_serial');
    const externalSystemName = searchParams.get('external_system_name');
    const verified = searchParams.get('verified');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 4. 조회 조건 구성
    const where: any = {};

    if (matchingMethod) {
      where.matching_method = matchingMethod;
    }

    if (equipmentSerial) {
      where.equipment_serial = {
        contains: equipmentSerial,
        mode: 'insensitive'
      };
    }

    if (externalSystemName) {
      where.external_system_name = externalSystemName;
    }

    if (verified !== null && verified !== undefined) {
      where.verified = verified === 'true';
    }

    // 5. 매핑 목록 조회
    const [mappings, total] = await Promise.all([
      prisma.aedPersistentMapping.findMany({
        where,
        orderBy: {
          updated_at: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.aedPersistentMapping.count({ where })
    ]);

    return NextResponse.json({
      mappings,
      total,
      limit,
      offset
    });

  } catch (error) {
    console.error('[GET /api/external-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/external-mapping
 * 외부 시스템 ID 매칭 (수작업/자동)
 *
 * Request Body:
 * {
 *   "equipmentSerial": "장비 시리얼 번호 (필수)",
 *   "externalId": "외부 시스템 ID (필수)",
 *   "systemName": "외부 시스템 이름 (필수)",
 *   "method": "매칭 방법 (manual/auto, 기본값: manual)",
 *   "confidence": "신뢰도 (0-100, 기본값: 100)",
 *   "notes": "메모 (선택)"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile || !checkPermission(userProfile.role, 'MANAGE_EXTERNAL_MAPPING')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_EXTERNAL_MAPPING') },
        { status: 403 }
      );
    }

    // 3. Request Body 파싱
    const body = await request.json();
    const {
      equipmentSerial,
      externalId,
      systemName,
      method = 'manual',
      confidence = 100.0,
      notes
    } = body;

    // 4. 필수 파라미터 검증
    if (!equipmentSerial || !externalId || !systemName) {
      return NextResponse.json(
        { error: 'equipmentSerial, externalId, and systemName are required' },
        { status: 400 }
      );
    }

    // 5. 기존 매핑 확인 (있으면 업데이트, 없으면 생성)
    const existingMapping = await prisma.aedPersistentMapping.findUnique({
      where: { equipment_serial: equipmentSerial }
    });

    let mapping;
    if (existingMapping) {
      // 기존 매핑 업데이트
      mapping = await prisma.aedPersistentMapping.update({
        where: { equipment_serial: equipmentSerial },
        data: {
          external_id: externalId,
          external_system_name: systemName,
          matching_method: method,
          confidence_score: confidence,
          notes,
          verified: false, // 재매칭 시 검증 초기화
          updated_at: new Date()
        }
      });
    } else {
      // 새 매핑 생성
      mapping = await prisma.aedPersistentMapping.create({
        data: {
          equipment_serial: equipmentSerial,
          external_id: externalId,
          external_system_name: systemName,
          matching_method: method,
          confidence_score: confidence,
          notes,
          verified: false
        }
      });
    }

    // 6. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        user_id: session.user.id,
        action: existingMapping ? 'external_mapping_updated' : 'external_mapping_created',
        resource_type: 'aed_persistent_mapping',
        resource_id: equipmentSerial,
        details: {
          equipment_serial: equipmentSerial,
          external_id: externalId,
          system_name: systemName,
          method,
          confidence
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[External Mapping ${existingMapping ? 'Updated' : 'Created'}] ${equipmentSerial} -> ${externalId} (${systemName})`);

    return NextResponse.json({
      success: true,
      mapping
    });

  } catch (error) {
    console.error('[POST /api/external-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/external-mapping
 * 매칭 검증 승인/취소
 *
 * Request Body:
 * {
 *   "equipmentSerial": "장비 시리얼 번호 (필수)",
 *   "verified": "검증 상태 (true/false, 필수)"
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile || !checkPermission(userProfile.role, 'MANAGE_EXTERNAL_MAPPING')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_EXTERNAL_MAPPING') },
        { status: 403 }
      );
    }

    // 3. Request Body 파싱
    const body = await request.json();
    const { equipmentSerial, verified } = body;

    // 4. 파라미터 검증
    if (!equipmentSerial || typeof verified !== 'boolean') {
      return NextResponse.json(
        { error: 'equipmentSerial and verified (boolean) are required' },
        { status: 400 }
      );
    }

    // 5. 매핑 업데이트
    const mapping = await prisma.aedPersistentMapping.update({
      where: { equipment_serial: equipmentSerial },
      data: {
        verified,
        verified_at: verified ? new Date() : null,
        verified_by: verified ? session.user.id : null,
        updated_at: new Date()
      }
    });

    // 6. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        user_id: session.user.id,
        action: verified ? 'external_mapping_verified' : 'external_mapping_unverified',
        resource_type: 'aed_persistent_mapping',
        resource_id: equipmentSerial,
        details: {
          equipment_serial: equipmentSerial,
          verified
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      mapping
    });

  } catch (error) {
    console.error('[PATCH /api/external-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/external-mapping
 * 매칭 삭제 (관리자만)
 *
 * Query Parameters:
 * - equipment_serial: 장비 시리얼 번호 (필수)
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile || !checkPermission(userProfile.role, 'MANAGE_EXTERNAL_MAPPING')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_EXTERNAL_MAPPING') },
        { status: 403 }
      );
    }

    // 3. Query Parameters 파싱
    const searchParams = request.nextUrl.searchParams;
    const equipmentSerial = searchParams.get('equipment_serial');

    if (!equipmentSerial) {
      return NextResponse.json(
        { error: 'equipment_serial parameter is required' },
        { status: 400 }
      );
    }

    // 4. 매핑 삭제
    await prisma.aedPersistentMapping.delete({
      where: { equipment_serial: equipmentSerial }
    });

    // 5. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        user_id: session.user.id,
        action: 'external_mapping_deleted',
        resource_type: 'aed_persistent_mapping',
        resource_id: equipmentSerial,
        details: {
          equipment_serial: equipmentSerial
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[External Mapping Deleted] ${equipmentSerial}`);

    return NextResponse.json({
      success: true,
      message: '매핑이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('[DELETE /api/external-mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
