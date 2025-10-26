import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 수정이 필요한 5개 센터
const CORRECTIONS = [
  {
    name: '강원응급의료지원센터',
    latitude: 37.8813,
    longitude: 127.7298,
    address: '강원특별자치도 춘천시 중앙로 1',
    note: '강원도청 (춘천)'
  },
  {
    name: '경북응급의료지원센터',
    latitude: 36.5684,
    longitude: 128.7294,
    address: '경상북도 안동시 풍천면 도청대로 455',
    note: '경상북도청 (안동)'
  },
  {
    name: '대전응급의료지원센터',
    latitude: 36.3504,
    longitude: 127.3845,
    address: '대전광역시 서구 둔산로 100',
    note: '대전시청',
    region_code: 'DAEJ' // 수정 필요
  },
  {
    name: '제주응급의료지원센터',
    latitude: 33.4890,
    longitude: 126.4983,
    address: '제주특별자치도 제주시 문연로 6',
    note: '제주도청'
  },
  {
    name: '중앙응급의료센터',
    latitude: 37.5665,
    longitude: 126.9780,
    address: '서울특별시 중구 세종대로 110',
    note: '서울시청',
    region_code: 'SEO' // 수정 필요
  }
];

async function fixEmergencyCenters() {
  console.log('=== 응급의료센터 좌표 수정 시작 ===\n');

  for (const correction of CORRECTIONS) {
    console.log(`📍 ${correction.name} 업데이트 중...`);
    console.log(`   위치: ${correction.note}`);
    console.log(`   좌표: ${correction.latitude}, ${correction.longitude}`);
    console.log(`   주소: ${correction.address}`);

    const updateData: any = {
      latitude: correction.latitude,
      longitude: correction.longitude,
      address: correction.address,
      updated_at: new Date().toISOString()
    };

    // region_code도 수정이 필요한 경우
    if (correction.region_code) {
      updateData.region_code = correction.region_code;
      console.log(`   region_code: ${correction.region_code}`);
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('name', correction.name)
      .eq('type', 'emergency_center')
      .select();

    if (error) {
      console.error(`   ❌ 실패:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`   ✅ 성공`);
    } else {
      console.log(`   ⚠️  조직을 찾을 수 없음`);
    }
    console.log('');
  }

  console.log('=== 수정 완료 ===');
  console.log(`총 ${CORRECTIONS.length}개 센터 업데이트 시도\n`);

  // 검증
  console.log('=== 검증 시작 ===\n');
  for (const correction of CORRECTIONS) {
    const { data, error } = await supabase
      .from('organizations')
      .select('name, latitude, longitude, region_code')
      .eq('name', correction.name)
      .single();

    if (data) {
      const latMatch = Math.abs(data.latitude - correction.latitude) < 0.001;
      const lngMatch = Math.abs(data.longitude - correction.longitude) < 0.001;

      if (latMatch && lngMatch) {
        console.log(`✅ ${data.name} - 좌표 확인 완료`);
      } else {
        console.log(`❌ ${data.name} - 좌표 불일치`);
        console.log(`   현재: ${data.latitude}, ${data.longitude}`);
        console.log(`   예상: ${correction.latitude}, ${correction.longitude}`);
      }
    }
  }
}

fixEmergencyCenters();
