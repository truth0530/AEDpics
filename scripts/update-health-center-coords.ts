/**
 * 보건소 좌표 수집 및 업데이트 스크립트
 *
 * 카카오 로컬 API를 사용하여 전국 보건소의 정확한 위도/경도를 수집하고
 * organizations 테이블을 업데이트합니다.
 *
 * 실행 방법:
 * npx tsx scripts/update-health-center-coords.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ES 모듈에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.local 로드
config({ path: resolve(__dirname, '../.env.local') });

// Supabase 클라이언트 생성 (Service Role Key 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY!;

interface KakaoSearchResult {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  category_name: string;
  distance: string;
}

interface HealthCenter {
  id: string;
  name: string;
  region_code: string;
  city_code: string;
  address: string | null;
}

/**
 * 카카오 로컬 API로 보건소 검색
 */
async function searchHealthCenterKakao(
  centerName: string,
  retryCount = 0
): Promise<{ latitude: number; longitude: number; address: string; place_name: string } | null> {
  try {
    // 보건소명 정제 (검색 정확도 향상)
    const cleanName = centerName
      .replace('특별시', '')
      .replace('광역시', '')
      .replace('특별자치시', '')
      .replace('특별자치도', '')
      .replace('도', '')
      .trim();

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cleanName)}&size=5`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      // Rate limit 처리
      if (response.status === 429 && retryCount < 3) {
        console.log(`⏳ Rate limit, waiting 1 second... (retry ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return searchHealthCenterKakao(centerName, retryCount + 1);
      }
      throw new Error(`Kakao API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
      return null;
    }

    // 첫 번째 결과 사용 (보통 가장 정확)
    const result: KakaoSearchResult = data.documents[0];

    return {
      latitude: parseFloat(result.y),
      longitude: parseFloat(result.x),
      address: result.road_address_name || result.address_name,
      place_name: result.place_name
    };

  } catch (error) {
    console.error(`❌ Kakao search failed for ${centerName}:`, error);
    return null;
  }
}

/**
 * Organizations 테이블에서 보건소 목록 조회
 */
async function fetchHealthCenters(): Promise<HealthCenter[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, region_code, city_code, address')
    .eq('type', 'health_center')
    .order('region_code', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch health centers: ${error.message}`);
  }

  return data as HealthCenter[];
}

/**
 * 보건소 좌표 업데이트
 */
async function updateHealthCenterCoords(
  id: string,
  latitude: number,
  longitude: number,
  address: string
): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({
      latitude,
      longitude,
      address,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update: ${error.message}`);
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 Starting health center coordinates update...\n');

  // 1. 보건소 목록 조회
  console.log('📋 Fetching health centers from database...');
  const healthCenters = await fetchHealthCenters();
  console.log(`✅ Found ${healthCenters.length} health centers\n`);

  // 2. 통계 변수
  let successCount = 0;
  let failedCount = 0;
  const skippedCount = 0;
  const failedCenters: string[] = [];

  // 3. 각 보건소 처리
  for (let i = 0; i < healthCenters.length; i++) {
    const center = healthCenters[i];
    const progress = `[${i + 1}/${healthCenters.length}]`;

    console.log(`${progress} Processing: ${center.name}`);

    try {
      // 카카오 API로 검색
      const coords = await searchHealthCenterKakao(center.name);

      if (!coords) {
        console.log(`  ⚠️  Not found in Kakao\n`);
        failedCount++;
        failedCenters.push(center.name);
        continue;
      }

      // DB 업데이트
      await updateHealthCenterCoords(
        center.id,
        coords.latitude,
        coords.longitude,
        coords.address
      );

      console.log(`  ✅ Updated: ${coords.place_name}`);
      console.log(`  📍 Coords: (${coords.latitude}, ${coords.longitude})`);
      console.log(`  📮 Address: ${coords.address}\n`);

      successCount++;

      // Rate limit 방지 (카카오는 초당 10회 제한)
      if ((i + 1) % 10 === 0) {
        console.log('⏳ Pausing for 1 second to avoid rate limit...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`  ❌ Error:`, error);
      failedCount++;
      failedCenters.push(center.name);
    }
  }

  // 4. 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 Update Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📝 Total:   ${healthCenters.length}`);
  console.log(`📈 Success Rate: ${((successCount / healthCenters.length) * 100).toFixed(1)}%`);

  if (failedCenters.length > 0) {
    console.log('\n❌ Failed health centers:');
    failedCenters.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n✨ Done!');
}

// 실행
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
