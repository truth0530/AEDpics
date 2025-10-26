/**
 * 전체 조직(응급의료센터, 보건복지부 등) 좌표 확인
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

async function checkOrganizations() {
  console.log('📊 Checking all organizations...\n');

  // 1. 응급의료센터
  console.log('🏥 Emergency Centers (응급의료지원센터):');
  const { data: emergencyCenters } = await supabase
    .from('organizations')
    .select('id, name, type, region_code, latitude, longitude')
    .eq('type', 'emergency_center')
    .order('name');

  if (emergencyCenters) {
    emergencyCenters.forEach(center => {
      const hasCoords = center.latitude && center.longitude;
      console.log(`   ${hasCoords ? '✅' : '❌'} ${center.name} (region: ${center.region_code || 'N/A'})`);
      if (hasCoords) {
        console.log(`      📍 (${center.latitude}, ${center.longitude})`);
      }
    });
  }

  // 2. 보건복지부
  console.log('\n🏛️  Ministry (보건복지부):');
  const { data: ministry } = await supabase
    .from('organizations')
    .select('id, name, type, region_code, latitude, longitude')
    .or('type.eq.ministry,type.eq.national');

  if (ministry) {
    ministry.forEach(org => {
      const hasCoords = org.latitude && org.longitude;
      console.log(`   ${hasCoords ? '✅' : '❌'} ${org.name} (type: ${org.type})`);
      if (hasCoords) {
        console.log(`      📍 (${org.latitude}, ${org.longitude})`);
      }
    });
  }

  // 3. 모든 조직 타입 확인
  console.log('\n📋 All organization types:');
  const { data: allTypes } = await supabase
    .from('organizations')
    .select('type')
    .order('type');

  if (allTypes) {
    const uniqueTypes = [...new Set(allTypes.map(o => o.type))];
    uniqueTypes.forEach(type => {
      console.log(`   - ${type}`);
    });
  }
}

checkOrganizations().catch(console.error);
