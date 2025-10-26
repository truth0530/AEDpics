/**
 * 전체 응급의료센터 및 보건복지부 좌표 업데이트
 *
 * 규칙:
 * - 17개 시도 응급의료지원센터 → 해당 시도청 위치
 * - 중앙응급의료센터 → 서울시청 위치 (중앙 행정)
 * - 세종응급의료지원센터 → 세종시청 위치
 * - 보건복지부 → 세종시청 위치
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 17개 시도청 + 세종시청 좌표
const REGION_COORDS: Record<string, { lat: number; lng: number; address: string }> = {
  // 특별시/광역시
  'SEO': { lat: 37.5665, lng: 126.9780, address: '서울특별시 중구 세종대로 110' }, // 서울시청
  'BUS': { lat: 35.1796, lng: 129.0756, address: '부산광역시 연제구 중앙대로 1001' }, // 부산시청
  'DAE': { lat: 35.8714, lng: 128.6014, address: '대구광역시 중구 공평로 88' }, // 대구시청
  'INC': { lat: 37.4563, lng: 126.7052, address: '인천광역시 남동구 정각로 29' }, // 인천시청
  'GWA': { lat: 35.1595, lng: 126.8526, address: '광주광역시 서구 내방로 111' }, // 광주시청
  'DAJ': { lat: 36.3504, lng: 127.3845, address: '대전광역시 서구 둔산로 100' }, // 대전시청
  'ULS': { lat: 35.5384, lng: 129.3114, address: '울산광역시 남구 중앙로 201' }, // 울산시청
  'SEJ': { lat: 36.4801, lng: 127.2890, address: '세종특별자치시 한누리대로 2130' }, // 세종시청

  // 도
  'GYE': { lat: 37.2636, lng: 127.0286, address: '경기도 수원시 영통구 도청로 30' }, // 경기도청
  'GAN': { lat: 37.8228, lng: 128.1555, address: '강원특별자치도 춘천시 중앙로 1' }, // 강원도청
  'CHB': { lat: 36.6357, lng: 127.4914, address: '충청북도 청주시 상당구 상당로 82' }, // 충북도청
  'CHN': { lat: 36.6588, lng: 126.6728, address: '충청남도 홍성군 홍북읍 충남대로 21' }, // 충남도청
  'JEB': { lat: 35.8203, lng: 127.1089, address: '전북특별자치도 전주시 완산구 효자로 225' }, // 전북도청
  'JEN': { lat: 34.8161, lng: 126.4630, address: '전라남도 무안군 삼향읍 오룡길 1' }, // 전남도청
  'GYB': { lat: 36.5760, lng: 128.5056, address: '경상북도 안동시 풍천면 도청대로 455' }, // 경북도청
  'GYN': { lat: 35.2383, lng: 128.6924, address: '경상남도 창원시 의창구 중앙대로 300' }, // 경남도청
  'JEJ': { lat: 33.4996, lng: 126.5312, address: '제주특별자치도 제주시 문연로 6' }, // 제주도청

  // 중앙 (서울시청과 동일)
  'KR': { lat: 37.5665, lng: 126.9780, address: '서울특별시 중구 세종대로 110' }, // 중앙응급의료센터
};

interface OrganizationUpdate {
  name: string;
  region_code: string;
  lat: number;
  lng: number;
  address: string;
}

async function updateAllEmergencyCenters() {
  console.log('🚀 Updating all emergency centers and ministry coordinates...\n');

  const updates: OrganizationUpdate[] = [];
  let successCount = 0;
  let failCount = 0;

  // 1. 응급의료센터 업데이트
  const { data: centers } = await supabase
    .from('organizations')
    .select('id, name, type, region_code, latitude, longitude')
    .eq('type', 'emergency_center')
    .order('name');

  if (centers) {
    for (const center of centers) {
      const regionCode = center.region_code;
      const coords = REGION_COORDS[regionCode];

      if (coords) {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            latitude: coords.lat,
            longitude: coords.lng,
            address: coords.address
          })
          .eq('id', center.id)
          .select();

        if (error) {
          console.error(`❌ Failed to update ${center.name}:`, error.message);
          failCount++;
        } else {
          console.log(`✅ Updated: ${center.name}`);
          console.log(`   📍 (${coords.lat}, ${coords.lng})`);
          console.log(`   📮 ${coords.address}\n`);
          successCount++;
        }
      } else {
        console.warn(`⚠️  No coordinates found for region: ${regionCode} (${center.name})`);
        failCount++;
      }

      // API rate limiting 방지
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 2. 보건복지부 업데이트 (세종시청과 동일)
  const sejongCoords = REGION_COORDS['SEJ'];
  const { data: ministry, error: ministryError } = await supabase
    .from('organizations')
    .update({
      latitude: sejongCoords.lat,
      longitude: sejongCoords.lng,
      address: sejongCoords.address
    })
    .eq('type', 'ministry')
    .eq('name', '보건복지부')
    .select();

  if (ministryError) {
    console.error(`❌ Failed to update 보건복지부:`, ministryError.message);
    failCount++;
  } else if (ministry && ministry.length > 0) {
    console.log(`✅ Updated: 보건복지부`);
    console.log(`   📍 (${sejongCoords.lat}, ${sejongCoords.lng})`);
    console.log(`   📮 ${sejongCoords.address}\n`);
    successCount++;
  }

  // 3. 최종 결과 확인
  console.log('\n' + '='.repeat(60));
  console.log('📊 Update Summary');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed:  ${failCount}`);

  // 4. 최종 상태 확인
  console.log('\n📋 Final Status:');
  const { data: finalCheck } = await supabase
    .from('organizations')
    .select('name, type, region_code, latitude, longitude')
    .or('type.eq.emergency_center,type.eq.ministry')
    .order('type, name');

  if (finalCheck) {
    finalCheck.forEach(org => {
      const hasCoords = org.latitude && org.longitude;
      console.log(`   ${hasCoords ? '✅' : '❌'} ${org.name} (${org.region_code || org.type})`);
      if (hasCoords) {
        console.log(`      📍 (${org.latitude}, ${org.longitude})`);
      }
    });
  }
}

updateAllEmergencyCenters().catch(console.error);
