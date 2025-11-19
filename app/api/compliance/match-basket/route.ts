import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * POST /api/compliance/match-basket
 * 담기 박스의 관리번호들을 의무설치기관에 일괄 매칭
 *
 * Request body:
 * - target_key: string (매칭할 기관)
 * - management_numbers: string[] (매칭할 관리번호들)
 * - year?: number (기본값: 2025)
 * - strategy?: 'add' | 'replace' (기본값: 'add')
 *   - 'add': 기존 매칭 유지 + 새로운 기관에 추가 (중복 허용)
 *   - 'replace': 기존 매칭 해제 + 새로운 기관으로 이동
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year, management_numbers, strategy = 'add' } = body;

    // year는 2025년만 허용
    const validYear = 2025;
    if (year && year !== validYear) {
      return NextResponse.json(
        { error: `Only year ${validYear} is supported` },
        { status: 400 }
      );
    }

    if (!target_key || !Array.isArray(management_numbers) || management_numbers.length === 0) {
      return NextResponse.json(
        { error: 'target_key and management_numbers array are required' },
        { status: 400 }
      );
    }

    // 의무설치기관 존재 확인 (2025년 고정)
    const targetInstitution = await prisma.target_list_2025.findUnique({
      where: { target_key },
    });

    if (!targetInstitution) {
      return NextResponse.json({ error: 'Target institution not found' }, { status: 404 });
    }

    // 각 management_number에 속한 equipment_serial 조회
    const equipmentSerials = await prisma.aed_data.findMany({
      where: {
        management_number: {
          in: management_numbers,
        },
      },
      select: {
        equipment_serial: true,
      },
    });

    if (equipmentSerials.length === 0) {
      return NextResponse.json(
        { error: 'No equipment found for the provided management numbers' },
        { status: 404 }
      );
    }

    const serialsToMatch = equipmentSerials.map((e) => e.equipment_serial);

    // 트랜잭션으로 매칭 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 전략에 따른 처리
      let deletedCount = 0;
      if (strategy === 'replace') {
        // 기존 매칭 레코드 삭제 (다른 기관의 매칭 해제)
        const deleteResult = await tx.target_list_devices.deleteMany({
          where: {
            equipment_serial: {
              in: serialsToMatch,
            },
            target_list_year: validYear,
            // 현재 기관의 매칭은 제외 (같은 기관 재매칭은 무시)
            NOT: {
              target_institution_id: target_key,
            },
          },
        });
        deletedCount = deleteResult.count;
      }

      // 2. 새로운 매칭 레코드 생성
      // 'add' 전략: 중복 체크 후 없는 것만 생성
      // 'replace' 전략: 모두 생성 (이미 삭제했으므로)
      const matchResults = await Promise.all(
        serialsToMatch.map(async (serial) => {
          // 이미 같은 기관에 매칭되어 있는지 확인
          const existing = await tx.target_list_devices.findFirst({
            where: {
              target_institution_id: target_key,
              equipment_serial: serial,
              target_list_year: validYear,
            },
          });

          if (existing) {
            // 이미 매칭됨 - 건너뛰기
            return { serial, status: 'already_matched' };
          }

          // 새로운 매칭 생성
          await tx.target_list_devices.create({
            data: {
              target_institution_id: target_key,
              equipment_serial: serial,
              target_list_year: validYear,
              matched_at: new Date(),
              matched_by: session.user!.id,
            },
          });

          return { serial, status: 'newly_matched' };
        })
      );

      // 3. 매칭 로그 기록
      const newlyMatchedCount = matchResults.filter((r) => r.status === 'newly_matched').length;
      const alreadyMatchedCount = matchResults.filter((r) => r.status === 'already_matched').length;

      const log = await tx.target_list_match_logs.create({
        data: {
          action: 'match',
          target_list_year: validYear,
          target_key,
          management_numbers,
          user_id: session.user!.id,
          reason: strategy === 'replace' ? '기존 매칭 해제 후 이동' : null,
        },
      });

      return {
        strategy,
        matched_count: management_numbers.length,
        equipment_count: serialsToMatch.length,
        newly_matched: newlyMatchedCount,
        already_matched: alreadyMatchedCount,
        deleted_previous: deletedCount,
        log_id: log.id,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Failed to match basket:', error);
    return NextResponse.json(
      { error: 'Failed to match basket', details: String(error) },
      { status: 500 }
    );
  }
}
