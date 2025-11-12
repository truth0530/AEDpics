import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, status, management_numbers, year = '2025', note } = body;

    if (!target_key || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      const yearSuffix = year === '2025' ? '_2025' : '_2024';

      if (status === 'installed' && management_numbers && management_numbers.length > 0) {
        // 설치 확인 - management_number_group_mapping 업데이트 또는 생성
        const updates = [];

        for (const managementNumber of management_numbers) {
          // 기존 매핑 확인
          const existing = await tx.management_number_group_mapping.findUnique({
            where: { management_number: managementNumber }
          });

          if (existing) {
            // 업데이트
            const updated = await tx.management_number_group_mapping.update({
              where: { management_number: managementNumber },
              data: {
                [`target_key${yearSuffix}`]: target_key,
                [`confirmed${yearSuffix}`]: true,
                [`confirmed_by${yearSuffix}`]: session.user.id,
                [`confirmed_at${yearSuffix}`]: new Date(),
                [`modification_note${yearSuffix}`]: note || '보건소 담당자 확인'
              }
            });
            updates.push(updated);
          } else {
            // 새로 생성
            const created = await tx.management_number_group_mapping.create({
              data: {
                id: uuidv4(),
                management_number: managementNumber,
                [`target_key${yearSuffix}`]: target_key,
                [`auto_suggested${yearSuffix}`]: target_key,
                [`auto_confidence${yearSuffix}`]: 100,
                [`auto_matching_reason${yearSuffix}`]: {
                  method: 'manual',
                  details: ['보건소 담당자가 수동으로 확인']
                },
                [`confirmed${yearSuffix}`]: true,
                [`confirmed_by${yearSuffix}`]: session.user.id,
                [`confirmed_at${yearSuffix}`]: new Date(),
                [`modification_note${yearSuffix}`]: note || '보건소 담당자 확인'
              }
            });
            updates.push(created);
          }
        }

        // target_list_devices 업데이트
        for (const managementNumber of management_numbers) {
          // AED 장비 연번 조회
          const aedDevices = await tx.aed_data.findFirst({
            where: { management_number: managementNumber },
            select: { equipment_serial: true }
          });

          if (aedDevices?.equipment_serial) {
            for (const serial of aedDevices.equipment_serial) {
              const existingDevice = await tx.target_list_devices.findFirst({
                where: {
                  target_list_year: parseInt(year),
                  equipment_serial: serial
                }
              });

              if (!existingDevice) {
                await tx.target_list_devices.create({
                  data: {
                    id: uuidv4(),
                    target_list_year: parseInt(year),
                    target_institution_id: target_key,
                    equipment_serial: serial,
                    matching_method: 'manual',
                    matching_confidence: 100,
                    matched_by: session.user.id,
                    matched_at: new Date(),
                    verified_by: session.user.id,
                    verified_at: new Date(),
                    matching_reason: { note: note || '보건소 담당자 확인' }
                  }
                });
              }
            }
          }
        }

        return { status: 'success', updated: updates.length };

      } else if (status === 'not_installed') {
        // 미설치 확인 - 해당 타겟의 기존 매칭 제거
        const updated = await tx.management_number_group_mapping.updateMany({
          where: {
            [`target_key${yearSuffix}`]: target_key
          },
          data: {
            [`target_key${yearSuffix}`]: null,
            [`confirmed${yearSuffix}`]: false,
            [`modification_note${yearSuffix}`]: note || '미설치 확인'
          }
        });

        // target_list_devices에서도 제거
        await tx.target_list_devices.deleteMany({
          where: {
            target_list_year: parseInt(year),
            target_institution_id: target_key
          }
        });

        return { status: 'success', updated: updated.count };
      }

      return { status: 'error', message: 'Invalid status' };
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Compliance update error:', error);
    return NextResponse.json(
      { error: 'Failed to update compliance status' },
      { status: 500 }
    );
  }
}