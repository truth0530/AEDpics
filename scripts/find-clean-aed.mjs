import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findCleanAEDs() {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(today.getDate() - 60);

    // 대구 지역, 외부표출 Y, 배터리/패드 정상인 장비 먼저 찾기
    const relaxedAEDs = await prisma.aed_data.findMany({
      where: {
        sido: '대구',
        external_display: 'Y',
        OR: [
          { battery_expiry_date: null },
          { battery_expiry_date: { gt: thirtyDaysFromNow } }
        ]
      },
      select: {
        equipment_serial: true,
        management_number: true,
        installation_institution: true,
        installation_location_address: true,
        battery_expiry_date: true,
        patch_expiry_date: true,
        last_inspection_date: true,
        serial_number: true,
      },
      take: 10
    });

    console.log('\n=== 대구 지역 AED 장비 조회 결과 ===\n');

    for (let i = 0; i < relaxedAEDs.length; i++) {
      const aed = relaxedAEDs[i];
      console.log(`\n[${i + 1}] 장비연번: ${aed.equipment_serial}`);
      console.log(`    관리번호: ${aed.management_number}`);
      console.log(`    기관명: ${aed.installation_institution}`);
      console.log(`    배터리 만료: ${aed.battery_expiry_date || '없음'}`);
      console.log(`    패드 만료: ${aed.patch_expiry_date || '없음'}`);
      console.log(`    최근 점검: ${aed.last_inspection_date || '없음'}`);
      console.log(`    제조번호: ${aed.serial_number || '없음'}`);

      // 배터리 체크
      let batteryOK = true;
      if (aed.battery_expiry_date) {
        const batteryDays = Math.floor((new Date(aed.battery_expiry_date) - today) / (1000 * 60 * 60 * 24));
        if (batteryDays <= 30) {
          console.log(`    ⚠️ 배터리: ${batteryDays}일 남음 (경고)`);
          batteryOK = false;
        } else {
          console.log(`    ✅ 배터리: ${batteryDays}일 남음 (정상)`);
        }
      } else {
        console.log(`    ✅ 배터리: 정보 없음 (경고 안뜸)`);
      }

      // 패드 체크
      let padOK = true;
      if (aed.patch_expiry_date) {
        const padDays = Math.floor((new Date(aed.patch_expiry_date) - today) / (1000 * 60 * 60 * 24));
        if (padDays <= 30) {
          console.log(`    ⚠️ 패드: ${padDays}일 남음 (경고)`);
          padOK = false;
        } else {
          console.log(`    ✅ 패드: ${padDays}일 남음 (정상)`);
        }
      } else {
        console.log(`    ✅ 패드: 정보 없음 (경고 안뜸)`);
      }

      // 점검일 체크
      let inspectionOK = true;
      if (aed.last_inspection_date) {
        const daysSince = Math.floor((today - new Date(aed.last_inspection_date)) / (1000 * 60 * 60 * 24));
        if (daysSince > 60) {
          console.log(`    ⚠️ 점검: ${daysSince}일 전 (60일 초과, 경고)`);
          inspectionOK = false;
        } else {
          console.log(`    ✅ 점검: ${daysSince}일 전 (60일 이내, 정상)`);
        }
      } else {
        console.log(`    ⚠️ 점검: 이력 없음 (경고)`);
        inspectionOK = false;
      }

      // 최종 판정
      if (batteryOK && padOK && inspectionOK) {
        console.log(`    🎉 결과: "특이사항 없음" 표시됨!`);
      } else {
        console.log(`    ❌ 결과: 경고 표시됨`);
      }
    }

    console.log('\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findCleanAEDs();
