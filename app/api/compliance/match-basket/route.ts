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
 * - equipment_serials?: string[] (특정 장비만 매칭할 경우 - 제공 안 하면 management_numbers의 모든 장비)
 * - year?: number (기본값: 2025)
 * - strategy?: 'add' | 'replace' (기본값: 'add')
 *   - 'add': 기존 매칭 유지 + 새로운 기관에 추가 (중복 시 에러)
 *   - 'replace': 기존 매칭 해제 + 새로운 기관으로 이동
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth & Basic Validation
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year, management_numbers, equipment_serials, strategy = 'add' } = body;

    // Validate Year
    const validYear = 2025;
    if (year && year !== validYear) {
      return NextResponse.json({ error: `Only year ${validYear} is supported` }, { status: 400 });
    }

    // Validate Inputs
    if (!target_key || !Array.isArray(management_numbers) || management_numbers.length === 0) {
      return NextResponse.json({ error: 'target_key and management_numbers array are required' }, { status: 400 });
    }

    if (target_key.length > 50) {
      return NextResponse.json({ error: 'target_key exceeds 50 characters' }, { status: 400 });
    }

    if (!['add', 'replace'].includes(strategy)) {
      return NextResponse.json({ error: "Invalid strategy. Must be 'add' or 'replace'" }, { status: 400 });
    }

    // 2. User Existence Check (Foreign Key Integrity)
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 401 });
    }

    // 3. Target Institution Check
    const targetInstitution = await prisma.target_list_2025.findUnique({
      where: { target_key },
    });

    if (!targetInstitution) {
      return NextResponse.json({ error: 'Target institution not found' }, { status: 404 });
    }

    // 4. Get Serials
    let serialsToMatch: string[];

    // equipment_serials가 제공되면 해당 serial만 사용
    if (equipment_serials && Array.isArray(equipment_serials) && equipment_serials.length > 0) {
      // 제공된 serial들이 실제로 management_numbers에 속하는지 검증
      const validSerials = await prisma.aed_data.findMany({
        where: {
          equipment_serial: { in: equipment_serials },
          management_number: { in: management_numbers }
        },
        select: { equipment_serial: true },
      });

      if (validSerials.length === 0) {
        return NextResponse.json({ error: 'No valid equipment found for the provided serials and management numbers' }, { status: 404 });
      }

      serialsToMatch = validSerials.map((e) => e.equipment_serial);
      console.log('[match-basket] Using specific equipment_serials:', serialsToMatch);
    } else {
      // 기존 로직: management_numbers의 모든 장비 사용
      const equipmentSerials = await prisma.aed_data.findMany({
        where: { management_number: { in: management_numbers } },
        select: { equipment_serial: true },
      });

      if (equipmentSerials.length === 0) {
        return NextResponse.json({ error: 'No equipment found for the provided management numbers' }, { status: 404 });
      }

      serialsToMatch = equipmentSerials.map((e) => e.equipment_serial);
      console.log('[match-basket] Using all serials from management_numbers:', serialsToMatch);
    }

    // 5. Transaction with Set-based Logic
    const result = await prisma.$transaction(async (tx) => {
      // Batch Read Existing Matches
      const existingMatches = await tx.target_list_devices.findMany({
        where: {
          equipment_serial: { in: serialsToMatch },
          target_list_year: validYear,
        },
      });

      // In-Memory Classification
      const existingMap = new Map(existingMatches.map(e => [e.equipment_serial, e]));

      const toCreate: any[] = [];
      const toDeleteIds: string[] = [];
      const conflicts: any[] = [];
      let alreadyMatchedCount = 0;

      for (const serial of serialsToMatch) {
        const existing = existingMap.get(serial);

        if (!existing) {
          // Case 1: No match exists -> Create
          toCreate.push({
            target_institution_id: target_key,
            equipment_serial: serial,
            target_list_year: validYear,
            matched_at: new Date(),
            matched_by: session.user!.id,
            matching_method: 'manual',
          });
          continue;
        }

        if (existing.target_institution_id === target_key) {
          // Case 2: Already matched to THIS institution -> Skip
          alreadyMatchedCount++;
          continue;
        }

        // Case 3: Matched to DIFFERENT institution
        if (strategy === 'replace') {
          // Replace -> Delete old, Create new
          toDeleteIds.push(existing.id);
          toCreate.push({
            target_institution_id: target_key,
            equipment_serial: serial,
            target_list_year: validYear,
            matched_at: new Date(),
            matched_by: session.user!.id,
            matching_method: 'manual',
          });
        } else {
          // Add -> Conflict
          conflicts.push({
            serial,
            current_institution: existing.target_institution_id
          });
        }
      }

      // Check Conflicts
      if (conflicts.length > 0) {
        const error = new Error('Conflict detected');
        (error as any).code = 'CONFLICT_DETECTED';
        (error as any).conflicts = conflicts;
        throw error;
      }

      // Batch Write
      if (toDeleteIds.length > 0) {
        await tx.target_list_devices.deleteMany({
          where: { id: { in: toDeleteIds } }
        });
      }

      if (toCreate.length > 0) {
        await tx.target_list_devices.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      // Log
      const log = await tx.target_list_match_logs.create({
        data: {
          action: 'match',
          target_list_year: validYear,
          target_key,
          management_numbers,
          user_id: session.user!.id,
          reason: strategy === 'replace' ? '기존 매칭 해제 후 이동' : '일괄 매칭',
        },
      });

      return {
        success: true,
        strategy,
        matched_count: management_numbers.length,
        equipment_count: serialsToMatch.length,
        newly_matched: toCreate.length,
        already_matched: alreadyMatchedCount,
        deleted_previous: toDeleteIds.length,
        log_id: log.id,
      };
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Failed to match basket:', error);

    if (error.code === 'CONFLICT_DETECTED') {
      return NextResponse.json({
        error: '일부 장비가 다른 기관에 이미 매칭되어 있습니다.',
        conflicts: error.conflicts
      }, { status: 409 });
    }

    // Prisma Errors
    if (error.code === 'P2002') { // Unique constraint
      return NextResponse.json({ error: 'Duplicate matching detected' }, { status: 409 });
    }
    if (error.code === 'P2003') { // Foreign key
      return NextResponse.json({ error: 'Invalid reference (User or Institution)' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to match basket', details: String(error) },
      { status: 500 }
    );
  }
}
