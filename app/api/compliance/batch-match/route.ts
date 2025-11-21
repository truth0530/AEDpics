import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';

interface BatchMatchRequest {
  groupId?: string;
  institutionKeys: string[];
  managementNumbers: string[];
  year: string;
  userId?: string;
}

interface MatchResult {
  institutionKey: string;
  managementNumber: string;
  equipmentSerials: string[];
  success: boolean;
  error?: string;
}

/**
 * POST /api/compliance/batch-match
 * 그룹 단위 일괄 매칭 처리
 *
 * NOTE: 이 API는 현재 개발 중입니다.
 * compliance_matches, aed_device 등의 테이블이 생성된 후 구현 예정입니다.
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: BatchMatchRequest = await request.json();
    const {
      groupId,
      institutionKeys,
      managementNumbers,
      year,
      userId = session.user.email
    } = body;

    // 입력 검증
    if (!institutionKeys?.length || !managementNumbers?.length) {
      return NextResponse.json(
        { error: 'Institution keys and management numbers are required' },
        { status: 400 }
      );
    }

    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      );
    }

    // TODO: 실제 매칭 로직 구현
    // 현재는 개발 중이므로 임시 성공 응답 반환
    console.log('Batch match request received:', {
      groupId,
      institutionKeys,
      managementNumbers,
      year,
      userId
    });

    // 임시 응답
    return NextResponse.json({
      success: true,
      matched: institutionKeys.length,
      failed: 0,
      totalProcessed: institutionKeys.length * managementNumbers.length,
      details: institutionKeys.map(key => ({
        institutionKey: key,
        managementNumber: managementNumbers[0],
        equipmentSerials: [],
        success: true
      })),
      summary: {
        message: `Batch matching API is under development. Will match ${institutionKeys.length} institutions`,
        timestamp: new Date().toISOString(),
        groupId
      }
    });

    /* 원래 구현 (테이블 생성 후 활성화)
    const results: MatchResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 트랜잭션으로 일괄 처리
    await prisma.$transaction(async (tx) => {
      // 각 기관에 대해 매칭 처리
      for (const institutionKey of institutionKeys) {
        try {
          // 기관에 해당하는 모든 관리번호에 대해 매칭
          for (const managementNumber of managementNumbers) {
            // 해당 관리번호의 장비들 조회
            const devices = await tx.aed_device.findMany({
              where: {
                management_number: managementNumber,
                year: parseInt(year)
              },
              select: {
                equipment_serial: true,
                institution_name: true,
                address: true
              }
            });

            if (devices.length === 0) {
              results.push({
                institutionKey,
                managementNumber,
                equipmentSerials: [],
                success: false,
                error: 'No devices found for this management number'
              });
              failedCount++;
              continue;
            }

            // 장비연번 추출
            const equipmentSerials = devices
              .map(d => d.equipment_serial)
              .filter((serial): serial is string => serial !== null);

            // 기존 매칭 삭제 (중복 방지)
            await tx.compliance_matches.deleteMany({
              where: {
                target_key: institutionKey,
                management_number: managementNumber,
                year,
                is_deleted: false
              }
            });

            // 새로운 매칭 생성
            const matchPromises = equipmentSerials.map(serial =>
              tx.compliance_matches.create({
                data: {
                  target_key: institutionKey,
                  management_number: managementNumber,
                  equipment_serial: serial,
                  year,
                  matched_at: new Date(),
                  matched_by: userId,
                  is_deleted: false,
                  confidence_score: 0.95, // 그룹 매칭은 높은 신뢰도
                  match_type: 'batch_group', // 그룹 일괄 매칭 표시
                  group_id: groupId,
                  institution_name: devices[0].institution_name || '',
                  address: devices[0].address || ''
                }
              })
            );

            await Promise.all(matchPromises);

            results.push({
              institutionKey,
              managementNumber,
              equipmentSerials,
              success: true
            });
            successCount++;
          }
        } catch (error) {
          console.error(`Error matching institution ${institutionKey}:`, error);
          results.push({
            institutionKey,
            managementNumber: '',
            equipmentSerials: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }
      }

      // 매칭 이력 기록
      await tx.compliance_match_history.create({
        data: {
          action_type: 'batch_match',
          target_keys: institutionKeys,
          management_numbers: managementNumbers,
          year,
          user_email: userId,
          group_id: groupId,
          success_count: successCount,
          failed_count: failedCount,
          performed_at: new Date(),
          metadata: {
            results: results.map(r => ({
              institutionKey: r.institutionKey,
              success: r.success,
              error: r.error
            }))
          }
        }
      });
    });

    // 응답 반환
    return NextResponse.json({
      success: true,
      matched: successCount,
      failed: failedCount,
      totalProcessed: institutionKeys.length * managementNumbers.length,
      details: results,
      summary: {
        message: `Successfully matched ${successCount} items from ${institutionKeys.length} institutions`,
        timestamp: new Date().toISOString(),
        groupId
      }
    });
    */

  } catch (error) {
    console.error('Error in batch matching:', error);
    return NextResponse.json(
      {
        error: 'Failed to process batch matching',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compliance/batch-match
 * 그룹 단위 일괄 매칭 취소
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { groupId, year } = body;

    if (!groupId || !year) {
      return NextResponse.json(
        { error: 'Group ID and year are required' },
        { status: 400 }
      );
    }

    // TODO: 실제 매칭 취소 로직 구현
    // 현재는 개발 중이므로 임시 성공 응답 반환
    console.log('Batch unmatch request received:', {
      groupId,
      year,
      user: session.user.email
    });

    return NextResponse.json({
      success: true,
      deletedCount: 0,
      message: `Batch unmatch API is under development. Group ${groupId} unmatch simulated`
    });

    /* 원래 구현 (테이블 생성 후 활성화)
    // 그룹 ID로 매칭 삭제
    const result = await prisma.compliance_matches.updateMany({
      where: {
        group_id: groupId,
        year,
        is_deleted: false
      },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: session.user.email
      }
    });

    // 이력 기록
    await prisma.compliance_match_history.create({
      data: {
        action_type: 'batch_unmatch',
        year,
        user_email: session.user.email,
        group_id: groupId,
        performed_at: new Date(),
        metadata: {
          deletedCount: result.count
        }
      }
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Successfully cancelled ${result.count} matches for group ${groupId}`
    });
    */

  } catch (error) {
    console.error('Error cancelling batch match:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel batch matching',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}