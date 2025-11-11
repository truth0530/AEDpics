import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * DELETE /api/compliance/unmatch
 * 의무설치기관의 매칭을 해제 (다른 사람 매칭 해제 시 사유 필수)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year, reason } = body;

    if (!target_key || !year) {
      return NextResponse.json(
        { error: 'target_key and year are required' },
        { status: 400 }
      );
    }

    // 현재 매칭된 레코드 조회
    const existingMatches = await prisma.target_list_devices.findMany({
      where: {
        target_institution_id: target_key,
        target_list_year: year,
      },
      select: {
        equipment_serial: true,
        matched_by: true,
      },
    });

    if (existingMatches.length === 0) {
      return NextResponse.json(
        { error: 'No matches found for this institution' },
        { status: 404 }
      );
    }

    // 다른 사람의 매칭인지 확인
    const isOthersMatch = existingMatches.some(
      (match) => match.matched_by !== session.user!.id
    );

    // 다른 사람의 매칭을 해제할 때 사유 필수
    if (isOthersMatch && (!reason || reason.trim() === '')) {
      return NextResponse.json(
        { error: 'Reason is required when unmatching others\' matches' },
        { status: 400 }
      );
    }

    const equipmentSerials = existingMatches.map((m) => m.equipment_serial);

    // 매칭된 management_number들 조회 (로그 기록용)
    const aedData = await prisma.aed_data.findMany({
      where: {
        equipment_serial: {
          in: equipmentSerials,
        },
      },
      select: {
        management_number: true,
      },
      distinct: ['management_number'],
    });

    const managementNumbers = aedData
      .map((a) => a.management_number)
      .filter((mn): mn is string => mn !== null);

    // 트랜잭션으로 매칭 해제 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. target_list_devices에서 레코드 삭제
      await tx.target_list_devices.deleteMany({
        where: {
          target_institution_id: target_key,
          target_list_year: year,
        },
      });

      // 2. 매칭 해제 로그 기록
      const log = await tx.target_list_match_logs.create({
        data: {
          action: 'unmatch',
          target_list_year: year,
          target_key,
          management_numbers: managementNumbers,
          user_id: session.user!.id,
          reason: reason || null,
        },
      });

      return {
        unmatched_count: managementNumbers.length,
        equipment_count: equipmentSerials.length,
        log_id: log.id,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Failed to unmatch:', error);
    return NextResponse.json(
      { error: 'Failed to unmatch', details: String(error) },
      { status: 500 }
    );
  }
}
