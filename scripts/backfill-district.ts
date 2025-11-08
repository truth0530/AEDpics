#!/usr/bin/env npx tsx
/**
 * District 필드 백필 스크립트
 *
 * 목적: null인 district 필드를 organization 정보로 채우기
 * 실행: npm run backfill:district
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function backfillDistrict(dryRun: boolean = true) {
  try {
    console.log(`🔄 District 백필 시작... (${dryRun ? 'DRY RUN' : 'APPLY'})\n`);

    // 1. district가 null인 사용자 조회
    const usersWithNullDistrict = await prisma.user_profiles.findMany({
      where: {
        district: null,
        is_active: true
      },
      include: {
        organizations: {
          select: {
            name: true,
            city_code: true
          }
        }
      }
    });

    console.log(`📋 District가 null인 사용자: ${usersWithNullDistrict.length}명\n`);

    if (usersWithNullDistrict.length === 0) {
      console.log('✅ 모든 사용자의 district가 이미 설정되어 있습니다.');
      return;
    }

    // 조직명에서 district 추출하는 함수
    function extractDistrictFromOrgName(orgName: string): string | null {
      // "대구광역시 중구 보건소" → "중구"
      // "충청북도 충주시 보건소" → "충주시"
      // "김해시 보건소" → "김해시"
      // "제주시 보건소" → "제주시"

      // Pattern 1: "XX광역시/특별시 YY구 보건소" → "YY구"
      const cityDistrictPattern = /(?:서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시)\s+(.+구)\s+보건소/;
      const cityDistrictMatch = orgName.match(cityDistrictPattern);
      if (cityDistrictMatch) return cityDistrictMatch[1];

      // Pattern 2: "XX도 YY시 보건소" → "YY시"
      const provincePattern = /(?:경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|강원특별자치도|전북특별자치도|제주특별자치도)\s+(.+시)\s+보건소/;
      const provinceMatch = orgName.match(provincePattern);
      if (provinceMatch) return provinceMatch[1];

      // Pattern 3: "YY시 보건소" → "YY시" (for cases like "김해시 보건소", "제주시 보건소")
      const simpleCityPattern = /^(.+시)\s+보건소$/;
      const simpleCityMatch = orgName.match(simpleCityPattern);
      if (simpleCityMatch) return simpleCityMatch[1];

      // Pattern 4: "서귀포시 보건소" → "서귀포시"
      if (orgName.includes('서귀포시')) return '서귀포시';
      if (orgName.includes('제주시')) return '제주시';

      return null;
    }

    let updateCount = 0;
    let failedCount = 0;
    const updates: Array<{ id: string; name: string; district: string }> = [];

    for (const user of usersWithNullDistrict) {
      let district: string | null = null;

      // 1. 조직명에서 추출 시도
      if (user.organization_name) {
        district = extractDistrictFromOrgName(user.organization_name);
      }

      // 2. 조직 정보에서 추출 시도
      if (!district && user.organizations?.name) {
        district = extractDistrictFromOrgName(user.organizations.name);
      }

      if (district) {
        updates.push({
          id: user.id,
          name: user.full_name,
          district
        });
        updateCount++;
        console.log(`  ✅ ${user.full_name}: ${user.organization_name} → "${district}"`);
      } else {
        failedCount++;
        console.log(`  ❌ ${user.full_name}: district 추출 실패 (${user.organization_name})`);
      }
    }

    // 실제 업데이트 실행
    if (!dryRun && updates.length > 0) {
      console.log(`\n📝 데이터베이스 업데이트 중...`);

      for (const update of updates) {
        await prisma.user_profiles.update({
          where: { id: update.id },
          data: { district: update.district }
        });
      }

      console.log(`✅ ${updateCount}명의 district 업데이트 완료`);
    }

    // 결과 요약
    console.log(`\n📊 백필 결과:`);
    console.log(`   대상: ${usersWithNullDistrict.length}명`);
    console.log(`   성공: ${updateCount}명`);
    console.log(`   실패: ${failedCount}명`);

    if (dryRun && updateCount > 0) {
      console.log(`\n💡 실제 적용하려면 다음 명령어를 실행하세요:`);
      console.log(`   npm run backfill:district -- --apply`);
    }

  } catch (error) {
    console.error('❌ 백필 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI 인자 파싱
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

// 실행
backfillDistrict(dryRun)
  .then(() => {
    console.log('\n✅ 백필 스크립트 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 예상치 못한 오류:', error);
    process.exit(1);
  });