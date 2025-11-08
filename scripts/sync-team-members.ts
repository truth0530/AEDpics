#!/usr/bin/env npx tsx
/**
 * 팀 멤버 동기화 스크립트
 *
 * 목적: user_profiles의 활성 사용자를 team_members 테이블과 동기화
 * 실행: npm run sync:team-members
 */

import { syncAllTeamMembers } from '../lib/auth/team-sync';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('🔄 팀 멤버 동기화 시작...\n');

  try {
    const totalSynced = await syncAllTeamMembers();
    console.log(`\n✅ 동기화 완료: 총 ${totalSynced}명의 팀 멤버가 처리되었습니다.`);
  } catch (error) {
    console.error('❌ 동기화 실패:', error);
    process.exit(1);
  }
}

// 실행
main()
  .then(() => {
    console.log('\n🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 예상치 못한 오류:', error);
    process.exit(1);
  });