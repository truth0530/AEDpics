import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * POST /api/compliance/check-existing-matches
 * 매칭 시도 전 기존 매칭 상태 확인
 *
 * Request body:
 * - target_key: string (매칭하려는 기관)
 * - management_numbers: string[] (매칭하려는 관리번호들)
 * - year?: number (기본값: 2025)
 *
 * Response:
 * - has_conflicts: boolean (중복 매칭 여부)
 * - total_devices: number (전체 장비 수)
 * - already_matched_to_target: number (이미 해당 기관에 매칭된 수)
 * - matched_to_other: number (다른 기관에 매칭된 수)
 * - unmatched: number (매칭 안 된 수)
 * - conflicts: Array (중복 매칭 상세 정보)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, management_numbers, year = 2025 } = body;

    if (!target_key || !Array.isArray(management_numbers) || management_numbers.length === 0) {
      return NextResponse.json(
        { error: 'target_key and management_numbers array are required' },
        { status: 400 }
      );
    }

    // 1. 관리번호로 equipment_serial 조회
    const devices = await prisma.aed_data.findMany({
      where: {
        management_number: {
          in: management_numbers,
        },
      },
      select: {
        equipment_serial: true,
        management_number: true,
        installation_institution: true,
        installation_address: true,
        installation_position: true,
      },
    });

    if (devices.length === 0) {
      return NextResponse.json({
        has_conflicts: false,
        total_devices: 0,
        already_matched_to_target: 0,
        matched_to_other: 0,
        unmatched: 0,
        conflicts: [],
        message: 'No devices found for the provided management numbers',
      });
    }

    const serialsToCheck = devices.map((d) => d.equipment_serial);

    // 2. 기존 매칭 조회
    const existingMatches = await prisma.target_list_devices.findMany({
      where: {
        equipment_serial: {
          in: serialsToCheck,
        },
        target_list_year: year,
      },
      include: {},
    });

    // 3. 충돌 분석
    const conflicts: Array<{
      equipment_serial: string;
      management_number: string;
      device_info: {
        institution_name: string;
        address: string;
        installation_position?: string;
      };
      existing_matches: Array<{
        target_key: string;
        institution_name: string;
        management_number: string;
        matched_at: string;
        is_target_match: boolean;
      }>;
    }> = [];

    let already_matched_to_target = 0;
    let matched_to_other = 0;
    let unmatched = 0;

    devices.forEach((device) => {
      const deviceMatches = existingMatches.filter(
        (m) => m.equipment_serial === device.equipment_serial
      );

      if (deviceMatches.length === 0) {
        // 매칭 안 됨
        unmatched++;
      } else {
        const isMatchedToTarget = deviceMatches.some(
          (m) => m.target_institution_id === target_key
        );
        const isMatchedToOther = deviceMatches.some(
          (m) => m.target_institution_id !== target_key
        );

        if (isMatchedToTarget) {
          already_matched_to_target++;
        }

        if (isMatchedToOther) {
          matched_to_other++;

          // 다른 기관에 매칭된 경우 충돌 정보 기록
          conflicts.push({
            equipment_serial: device.equipment_serial,
            management_number: device.management_number || '',
            device_info: {
              institution_name: device.installation_institution || '',
              address: device.installation_address || '',
              installation_position: device.installation_position || undefined,
            },
            existing_matches: deviceMatches.map((m) => ({
              target_key: m.target_institution_id,
              institution_name: '',
              management_number: device.management_number || '',
              matched_at: m.matched_at.toISOString(),
              is_target_match: m.target_institution_id === target_key,
            })),
          });
        }
      }
    });

    const has_conflicts = matched_to_other > 0;

    return NextResponse.json({
      has_conflicts,
      total_devices: devices.length,
      already_matched_to_target,
      matched_to_other,
      unmatched,
      conflicts,
      summary: {
        message: has_conflicts
          ? `${matched_to_other}개의 장비가 이미 다른 기관에 매칭되어 있습니다.`
          : '모든 장비를 안전하게 매칭할 수 있습니다.',
      },
    });

  } catch (error) {
    console.error('Failed to check existing matches:', error);
    return NextResponse.json(
      { error: 'Failed to check existing matches', details: String(error) },
      { status: 500 }
    );
  }
}
