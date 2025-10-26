/**
 * 대구응급의료지원센터 좌표 수동 업데이트
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

async function updateEmergencyCenter() {
  console.log('🚀 Updating emergency center coordinates...\n');

  // 대구응급의료지원센터 좌표 업데이트
  const { data, error } = await supabase
    .from('organizations')
    .update({
      latitude: 35.8714,
      longitude: 128.6014
    })
    .eq('name', '대구응급의료지원센터')
    .eq('type', 'emergency_center')
    .select();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('✅ Successfully updated:');
    data.forEach(org => {
      console.log(`   - ${org.name}`);
      console.log(`     📍 Coords: (${org.latitude}, ${org.longitude})`);
      console.log(`     📮 Address: ${org.address || 'N/A'}\n`);
    });
  } else {
    console.log('⚠️  No records updated. Organization not found or already up to date.');
  }

  // 모든 응급의료센터 좌표 확인
  console.log('\n📊 All emergency centers:');
  const { data: allCenters } = await supabase
    .from('organizations')
    .select('id, name, latitude, longitude, address')
    .eq('type', 'emergency_center');

  if (allCenters) {
    allCenters.forEach(center => {
      const hasCoords = center.latitude && center.longitude;
      console.log(`   ${hasCoords ? '✅' : '❌'} ${center.name}`);
      if (hasCoords) {
        console.log(`      📍 (${center.latitude}, ${center.longitude})`);
      } else {
        console.log(`      ⚠️  No coordinates`);
      }
    });
  }
}

updateEmergencyCenter().catch(console.error);
