import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // 1. "삼덕청아람리슈빌아파트" AED 찾기
  const targetAED = await prisma.aed_data.findFirst({
    where: {
      OR: [
        { installation_institution: { contains: '삼덕청아람리슈빌아파트' } },
        { installation_position: { contains: '삼덕청아람리슈빌아파트' } },
        { installation_address: { contains: '삼덕청아람리슈빌아파트' } }
      ]
    },
    select: {
      equipment_serial: true,
      installation_institution: true,
      installation_position: true,
      installation_address: true,
      sido: true,
      gugun: true,
      category_1: true
    }
  });

  if (!targetAED) {
    console.log('삼덕청아람리슈빌아파트 AED를 찾을 수 없습니다.');
    console.log('유사한 이름 검색 중...');

    const similarAEDs = await prisma.aed_data.findMany({
      where: {
        OR: [
          { installation_institution: { contains: '삼덕' } },
          { installation_institution: { contains: '청아람' } },
          { installation_institution: { contains: '리슈빌' } },
          { installation_position: { contains: '삼덕' } },
          { installation_position: { contains: '청아람' } },
          { installation_position: { contains: '리슈빌' } }
        ]
      },
      select: {
        equipment_serial: true,
        installation_institution: true,
        installation_position: true,
        installation_address: true,
        sido: true,
        gugun: true
      },
      take: 10
    });

    console.log('유사한 위치 목록:');
    similarAEDs.forEach(aed => {
      console.log(`- ${aed.installation_institution || aed.installation_position} (${aed.sido} ${aed.gugun}, ${aed.equipment_serial})`);
    });
    return;
  }

  console.log('선택된 AED:');
  console.log(`- 장비번호: ${targetAED.equipment_serial}`);
  console.log(`- 설치기관: ${targetAED.installation_institution}`);
  console.log(`- 설치위치: ${targetAED.installation_position}`);
  console.log(`- 설치주소: ${targetAED.installation_address}`);
  console.log(`- 지역: ${targetAED.sido} ${targetAED.gugun}`);
  console.log(`- 분류: ${targetAED.category_1}`);

  // 2. 대구 응급의료지원센터 사용자 찾기 (created_by용)
  const daeguUser = await prisma.user_profiles.findFirst({
    where: {
      email: {
        contains: 'nemcdg@nmc.or.kr'
      }
    },
    select: {
      id: true,
      email: true
    }
  });

  if (!daeguUser) {
    console.log('\n대구 응급의료지원센터 사용자를 찾을 수 없습니다.');
    console.log('임의의 사용자를 찾는 중...');
    const anyUser = await prisma.user_profiles.findFirst({
      select: {
        id: true,
        email: true
      }
    });

    if (!anyUser) {
      console.log('사용자가 없습니다. 스크립트를 종료합니다.');
      return;
    }

    console.log(`사용자 발견: ${anyUser.email}`);
  } else {
    console.log(`\n사용자 발견: ${daeguUser.email}`);
  }

  const userId = (daeguUser || await prisma.user_profiles.findFirst({ select: { id: true } }))!.id;

  // 3. 테스트용 일정 추가
  const scheduleEntry = await prisma.inspection_schedule_entries.create({
    data: {
      id: randomUUID(),
      device_equipment_serial: targetAED.equipment_serial,
      scheduled_for: new Date(),
      assignee_identifier: 'nemcdg@nmc.or.kr', // 대구 응급의료지원센터
      priority: 'normal',
      status: 'scheduled',
      created_by: userId,
      notes: `테스트 일정 추가 - ${targetAED.installation_institution || targetAED.installation_position || '위치정보없음'}`
    }
  });

  console.log('\n일정 추가 완료:');
  console.log(`- ID: ${scheduleEntry.id}`);
  console.log(`- 장비번호: ${scheduleEntry.device_equipment_serial}`);
  console.log(`- 담당자: ${scheduleEntry.assignee_identifier}`);
  console.log(`- 상태: ${scheduleEntry.status}`);

  // 4. 추가 후 해당 지역의 일정추가 건수 확인
  const scheduleCount = await prisma.$queryRaw<Array<{
    count: bigint;
    mandatory_count: bigint;
    non_mandatory_count: bigint;
  }>>`
    SELECT
      COUNT(DISTINCT s.id)::bigint as count,
      COUNT(DISTINCT CASE WHEN a.category_1 = '구비의무기관' THEN s.id END)::bigint as mandatory_count,
      COUNT(DISTINCT CASE WHEN a.category_1 != '구비의무기관' THEN s.id END)::bigint as non_mandatory_count
    FROM aedpics.inspection_schedule_entries s
    INNER JOIN aedpics.aed_data a ON s.device_equipment_serial = a.equipment_serial
    WHERE a.sido = ${targetAED.sido} AND a.gugun = ${targetAED.gugun}
  `;

  console.log(`\n=== ${targetAED.sido} ${targetAED.gugun} 일정추가 현황 ===`);
  const scheduleData = scheduleCount[0];
  if (scheduleData) {
    console.log(`전체: ${scheduleData.count}건`);
    console.log(`의무기관: ${scheduleData.mandatory_count}건`);
    console.log(`비의무기관: ${scheduleData.non_mandatory_count}건`);
  }

  // 5. 해당 지역의 AED 총 개수 확인
  const totalAEDCount = await prisma.aed_data.count({
    where: {
      sido: targetAED.sido,
      gugun: targetAED.gugun
    }
  });

  // 6. 해당 지역의 현장점검 건수도 함께 확인 (분자/분모 검증)
  const inspectionCount = await prisma.$queryRaw<Array<{
    count: bigint;
  }>>`
    SELECT COUNT(DISTINCT i.id)::bigint as count
    FROM aedpics.inspections i
    INNER JOIN aedpics.aed_data a ON i.equipment_serial = a.equipment_serial
    WHERE a.sido = ${targetAED.sido} AND a.gugun = ${targetAED.gugun}
  `;

  console.log('\n=== 대시보드 표시 예상값 ===');
  console.log(`일정추가: ${scheduleData?.count || 0}건/${totalAEDCount}건`);
  console.log(`현장점검: ${inspectionCount[0]?.count || 0}건/${scheduleData?.count || 0}건`);
  console.log(`\n이제 브라우저에서 대시보드를 확인하여 위 값과 일치하는지 검증하세요.`);
  console.log(`대시보드에서 ${targetAED.sido} ${targetAED.gugun}를 선택하세요.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
