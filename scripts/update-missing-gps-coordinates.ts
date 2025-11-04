/**
 * GPS 좌표가 없는 보건소의 좌표를 Kakao Local API를 사용하여 자동 업데이트
 *
 * 실행 방법:
 * npx tsx scripts/update-missing-gps-coordinates.ts
 */

import { prisma } from '../lib/prisma';

// Kakao Local API로 주소 검색하여 좌표 가져오기
async function getCoordinatesFromAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

  if (!KAKAO_REST_API_KEY) {
    console.error('❌ KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다');
    return null;
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error(`❌ Kakao API 오류 (${address}):`, response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.documents && data.documents.length > 0) {
      const result = data.documents[0];
      return {
        lat: parseFloat(result.y),
        lng: parseFloat(result.x)
      };
    }

    console.warn(`⚠️  주소 검색 결과 없음: ${address}`);
    return null;
  } catch (error) {
    console.error(`❌ 좌표 조회 실패 (${address}):`, error);
    return null;
  }
}

// 딜레이 함수 (API Rate Limit 방지)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateMissingGPSCoordinates() {
  try {
    console.log('🔍 GPS 좌표가 없는 보건소 조회 중...\n');

    // GPS 좌표가 없는 보건소 조회
    const healthCenters = await prisma.organizations.findMany({
      where: {
        type: 'health_center',
        OR: [
          { latitude: null },
          { longitude: null }
        ]
      },
      orderBy: [
        { region_code: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log(`📋 총 ${healthCenters.length}개의 보건소가 GPS 좌표 업데이트 필요\n`);

    if (healthCenters.length === 0) {
      console.log('✅ 모든 보건소에 GPS 좌표가 등록되어 있습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < healthCenters.length; i++) {
      const center = healthCenters[i];
      const progress = `[${i + 1}/${healthCenters.length}]`;

      console.log(`${progress} ${center.name} (${center.address || '주소 없음'})`);

      if (!center.address) {
        console.log(`  ⚠️  주소 정보가 없어 건너뜁니다.\n`);
        failCount++;
        continue;
      }

      // Kakao API로 좌표 조회
      const coords = await getCoordinatesFromAddress(center.address);

      if (coords) {
        // DB 업데이트
        await prisma.organizations.update({
          where: { id: center.id },
          data: {
            latitude: coords.lat,
            longitude: coords.lng
          }
        });

        console.log(`  ✅ GPS 좌표 업데이트 완료: ${coords.lat}, ${coords.lng}\n`);
        successCount++;
      } else {
        console.log(`  ❌ GPS 좌표 조회 실패\n`);
        failCount++;
      }

      // API Rate Limit 방지 (초당 최대 10회)
      await delay(150);
    }

    console.log('\n========================================');
    console.log('📊 업데이트 결과');
    console.log('========================================');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`📋 전체: ${healthCenters.length}개`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ GPS 좌표 업데이트 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
updateMissingGPSCoordinates()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
