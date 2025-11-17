import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * POST /api/compliance/match-basket
 * 담기 박스의 관리번호들을 의무설치기관에 일괄 매칭
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year, management_numbers } = body;

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
      // 1. 기존 매칭 레코드 삭제 (재매칭 방지)
      await tx.target_list_devices.deleteMany({
        where: {
          equipment_serial: {
            in: serialsToMatch,
          },
          target_list_year: validYear,
        },
      });

      // 2. 새로운 매칭 레코드 생성
      // Note: createMany는 PostgreSQL default 생성을 건너뛸 수 있으므로 개별 create 사용
      await Promise.all(
        serialsToMatch.map((serial) =>
          tx.target_list_devices.create({
            data: {
              target_institution_id: target_key,
              equipment_serial: serial,
              target_list_year: validYear,
              matched_at: new Date(),
              matched_by: session.user!.id,
            },
          })
        )
      );

      // 3. 매칭 로그 기록
      const log = await tx.target_list_match_logs.create({
        data: {
          action: 'match',
          target_list_year: validYear,
          target_key,
          management_numbers,
          user_id: session.user!.id,
          reason: null, // 매칭 시에는 사유 불필요
        },
      });

      return {
        matched_count: management_numbers.length,
        equipment_count: serialsToMatch.length,
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
