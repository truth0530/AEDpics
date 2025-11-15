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

    if (!target_key || !year || !Array.isArray(management_numbers) || management_numbers.length === 0) {
      return NextResponse.json(
        { error: 'target_key, year, and management_numbers array are required' },
        { status: 400 }
      );
    }

    // 의무설치기관 존재 확인 (동적 테이블 선택)
    const targetInstitution = year === 2025
      ? await prisma.target_list_2025.findUnique({
          where: { target_key },
        })
      : await prisma.target_list_2024.findUnique({
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
          target_list_year: year,
        },
      });

      // 2. 새로운 매칭 레코드 생성
      const createData = serialsToMatch.map((serial) => ({
        target_institution_id: target_key,
        equipment_serial: serial,
        target_list_year: year,
        matched_at: new Date(),
        matched_by: session.user!.id,
      }));

      await tx.target_list_devices.createMany({
        data: createData,
      });

      // 3. 매칭 로그 기록
      const log = await tx.target_list_match_logs.create({
        data: {
          action: 'match',
          target_list_year: year,
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
