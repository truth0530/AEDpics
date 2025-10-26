/**
 * Organizations 데이터 자동 시딩 스크립트
 *
 * 실행 방법:
 * npx tsx scripts/seed-organizations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedOrganizations() {
  console.log('🌱 Organizations 데이터 시딩 시작...');
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  try {
    // seed_organizations.sql 파일 읽기
    const sqlPath = path.join(__dirname, '..', 'supabase', 'seed_organizations.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // SQL을 직접 실행할 수 없으므로, 파싱해서 데이터 추출
    console.log('⚠️  주의: SQL 파일을 직접 실행할 수 없습니다.');
    console.log('📋 Supabase Studio에서 직접 실행해주세요:');
    console.log('   1. http://localhost:54323 접속');
    console.log('   2. SQL Editor 열기');
    console.log('   3. supabase/seed_organizations.sql 파일 내용 붙여넣기');
    console.log('   4. Run 버튼 클릭\n');

    // 현재 organizations 개수 확인
    const { count, error } = await supabase
      .from('organizations')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Organizations 테이블 조회 실패:', error);
      return;
    }

    console.log(`📊 현재 organizations 데이터: ${count}개`);

    if (count === 0) {
      console.log('\n⚠️  Organizations 테이블이 비어있습니다!');
      console.log('✅ 위의 Supabase Studio 방법으로 seed 파일을 실행해주세요.');
    } else {
      console.log('✅ Organizations 데이터가 이미 존재합니다.');
    }

  } catch (error) {
    console.error('❌ Seed 실행 중 오류:', error);
    process.exit(1);
  }
}

seedOrganizations();
