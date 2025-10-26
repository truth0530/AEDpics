import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.local 파일 로드
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// 17개 응급의료센터 + 중앙응급의료센터 + 보건복지부
const EXPECTED_CENTERS = [
  { name: '서울응급의료지원센터', region: 'SEO', expected: '서울시청' },
  { name: '부산응급의료지원센터', region: 'BUS', expected: '부산시청' },
  { name: '대구응급의료지원센터', region: 'DAE', expected: '대구시청' },
  { name: '인천응급의료지원센터', region: 'INC', expected: '인천시청' },
  { name: '광주응급의료지원센터', region: 'GWA', expected: '광주시청' },
  { name: '대전응급의료지원센터', region: 'DAE', expected: '대전시청' },
  { name: '울산응급의료지원센터', region: 'ULS', expected: '울산시청' },
  { name: '세종응급의료지원센터', region: 'SEJ', expected: '세종시청' },
  { name: '경기응급의료지원센터', region: 'GYE', expected: '경기도청 (수원)' },
  { name: '강원응급의료지원센터', region: 'GAN', expected: '강원도청 (춘천)' },
  { name: '충북응급의료지원센터', region: 'CHB', expected: '충청북도청 (청주)' },
  { name: '충남응급의료지원센터', region: 'CHN', expected: '충청남도청 (홍성)' },
  { name: '전북응급의료지원센터', region: 'JEB', expected: '전북특별자치도청 (전주)' },
  { name: '전남응급의료지원센터', region: 'JEN', expected: '전라남도청 (무안)' },
  { name: '경북응급의료지원센터', region: 'GYB', expected: '경상북도청 (안동)' },
  { name: '경남응급의료지원센터', region: 'GYN', expected: '경상남도청 (창원)' },
  { name: '제주응급의료지원센터', region: 'JEJ', expected: '제주도청' },
  { name: '중앙응급의료센터', region: 'KR', expected: '서울시청' },
  { name: '보건복지부', region: null, expected: '세종시청' }
];

// 시도청 좌표
const CITY_HALL_COORDS: Record<string, { lat: number; lng: number; address: string }> = {
  'SEO': { lat: 37.5665, lng: 126.9780, address: '서울특별시 중구 세종대로 110' },
  'BUS': { lat: 35.1796, lng: 129.0756, address: '부산광역시 연제구 중앙대로 1001' },
  'DAE': { lat: 35.8714, lng: 128.6014, address: '대구광역시 중구 공평로 88' },
  'INC': { lat: 37.4563, lng: 126.7052, address: '인천광역시 남동구 정각로 29' },
  'GWA': { lat: 35.1595, lng: 126.8526, address: '광주광역시 서구 내방로 111' },
  'DAEJ': { lat: 36.3504, lng: 127.3845, address: '대전광역시 서구 둔산로 100' },
  'ULS': { lat: 35.5384, lng: 129.3114, address: '울산광역시 남구 중앙로 201' },
  'SEJ': { lat: 36.4800, lng: 127.2890, address: '세종특별자치시 한누리대로 2130' },
  'GYE': { lat: 37.2636, lng: 127.0286, address: '경기도 수원시 팔달구 효원로 1' },
  'GAN': { lat: 37.8813, lng: 127.7298, address: '강원특별자치도 춘천시 중앙로 1' },
  'CHB': { lat: 36.6357, lng: 127.4913, address: '충청북도 청주시 상당구 상당로 82' },
  'CHN': { lat: 36.6588, lng: 126.6728, address: '충청남도 홍성군 홍북읍 충남대로 21' },
  'JEB': { lat: 35.8203, lng: 127.1089, address: '전북특별자치도 전주시 완산구 효자로 225' },
  'JEN': { lat: 34.8162, lng: 126.4630, address: '전라남도 무안군 삼향읍 오룡길 1' },
  'GYB': { lat: 36.5684, lng: 128.7294, address: '경상북도 안동시 풍천면 도청대로 455' },
  'GYN': { lat: 35.2383, lng: 128.6920, address: '경상남도 창원시 의창구 중앙대로 300' },
  'JEJ': { lat: 33.4890, lng: 126.4983, address: '제주특별자치도 제주시 문연로 6' }
};

async function checkEmergencyCenters() {
  console.log('=== 응급의료센터 좌표 검증 ===\n');

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, type, region_code, latitude, longitude, address')
    .eq('type', 'emergency_center')
    .order('name');

  if (error) {
    console.error('조회 실패:', error);
    return;
  }

  console.log(`총 ${orgs?.length || 0}개 응급의료센터 발견\n`);

  let missingCount = 0;
  let correctCount = 0;
  let wrongCount = 0;

  for (const org of orgs || []) {
    const expected = EXPECTED_CENTERS.find(c => c.name === org.name);
    const hasCoords = org.latitude !== null && org.longitude !== null;

    if (!hasCoords) {
      console.log(`❌ ${org.name}`);
      console.log(`   상태: 좌표 누락 (latitude: ${org.latitude}, longitude: ${org.longitude})`);
      console.log(`   region_code: ${org.region_code}`);
      if (expected) {
        console.log(`   → 필요: ${expected.expected}`);
      }
      console.log('');
      missingCount++;
    } else {
      const regionCode = org.region_code;
      const expectedCoords = regionCode ? CITY_HALL_COORDS[regionCode] : CITY_HALL_COORDS['SEJ'];

      if (expectedCoords) {
        const latMatch = Math.abs(org.latitude - expectedCoords.lat) < 0.001;
        const lngMatch = Math.abs(org.longitude - expectedCoords.lng) < 0.001;

        if (latMatch && lngMatch) {
          console.log(`✅ ${org.name}`);
          console.log(`   좌표: ${org.latitude}, ${org.longitude}`);
          console.log(`   주소: ${expectedCoords.address}`);
          console.log('');
          correctCount++;
        } else {
          console.log(`⚠️  ${org.name}`);
          console.log(`   현재: ${org.latitude}, ${org.longitude}`);
          console.log(`   예상: ${expectedCoords.lat}, ${expectedCoords.lng}`);
          console.log(`   주소: ${expectedCoords.address}`);
          console.log('');
          wrongCount++;
        }
      } else {
        console.log(`⚠️  ${org.name} - region_code 매칭 실패 (${regionCode})`);
        wrongCount++;
      }
    }
  }

  console.log('\n=== 요약 ===');
  console.log(`✅ 올바른 좌표: ${correctCount}개`);
  console.log(`❌ 좌표 누락: ${missingCount}개`);
  console.log(`⚠️  잘못된 좌표: ${wrongCount}개`);
  console.log(`📊 총 ${orgs?.length || 0}개 중 ${correctCount}개 정상`);

  if (missingCount > 0 || wrongCount > 0) {
    console.log('\n🔧 수정이 필요한 센터가 있습니다.');
  }
}

checkEmergencyCenters();
