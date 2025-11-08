#!/usr/bin/env npx tsx
/**
 * 지역 코드 정규화 스크립트
 *
 * 목적: user_profiles와 organizations의 지역 코드 일관성 확보
 * 실행: npm run normalize:region-codes
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// 지역 코드 정규화 맵핑
const REGION_CODE_MAP: Record<string, string> = {
  'SEO': 'SEL',  // 서울
  'BUS': 'PUS',  // 부산
  'DAE': 'TAE',  // 대구
  'INC': 'ICN',  // 인천
  'GWA': 'KWJ',  // 광주
  'DAJ': 'TAJ',  // 대전
  'ULS': 'USN',  // 울산
  'SEJ': 'SEJ',  // 세종
  'GYE': 'KKI',  // 경기
  'GAN': 'KWN',  // 강원
  'CHU': 'CCN',  // 충북
  'CHN': 'CCN',  // 충남
  'JEO': 'JCN',  // 전북
  'JEN': 'JCN',  // 전남
  'GYB': 'KSN',  // 경북
  'GYN': 'KSN',  // 경남
  'JEJ': 'CJU',  // 제주
};

// city_code 정규화 맵핑
const CITY_CODE_MAP: Record<string, string> = {
  'gimhae': 'gimhae-si',
  'yangsan': 'yangsan-si',
  'changwon': 'changwon-si',
  'jinju': 'jinju-si',
  'tongyeong': 'tongyeong-si',
  'sacheon': 'sacheon-si',
  'geoje': 'geoje-si',
  'miryang': 'miryang-si',
  'gimcheon': 'gimcheon-si',
  'gumi': 'gumi-si',
  'yeongju': 'yeongju-si',
  'yeongcheon': 'yeongcheon-si',
  'sangju': 'sangju-si',
  'mungyeong': 'mungyeong-si',
  'gyeongsan': 'gyeongsan-si',
  'andong': 'andong-si',
  'pohang': 'pohang-si',
  'gyeongju': 'gyeongju-si',
};

function normalizeRegionCode(code: string | null): string | null {
  if (!code) return null;
  return REGION_CODE_MAP[code.toUpperCase()] || code;
}

function normalizeCityCode(code: string | null): string | null {
  if (!code) return null;
  return CITY_CODE_MAP[code.toLowerCase()] || code;
}

async function normalizeRegionCodes() {
  try {
    console.log('🔄 지역 코드 정규화 시작...\n');

    // 1. 사용자 지역 코드 정규화
    console.log('📍 사용자 지역 코드 정규화...');
    const users = await prisma.user_profiles.findMany({
      where: {
        region_code: { not: null }
      },
      select: {
        id: true,
        full_name: true,
        region_code: true
      }
    });

    let userUpdated = 0;
    for (const user of users) {
      const newRegionCode = normalizeRegionCode(user.region_code);

      if (newRegionCode !== user.region_code) {
        await prisma.user_profiles.update({
          where: { id: user.id },
          data: {
            region_code: newRegionCode
          }
        });
        userUpdated++;
        console.log(`   ✅ ${user.full_name}: ${user.region_code}→${newRegionCode}`);
      }
    }
    console.log(`   사용자 업데이트: ${userUpdated}/${users.length}명\n`);

    // 2. 조직 지역 코드 정규화
    console.log('🏢 조직 지역 코드 정규화...');
    const organizations = await prisma.organizations.findMany({
      where: {
        OR: [
          { region_code: { not: null } },
          { city_code: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        region_code: true,
        city_code: true
      }
    });

    let orgUpdated = 0;
    for (const org of organizations) {
      const newRegionCode = normalizeRegionCode(org.region_code);
      const newCityCode = normalizeCityCode(org.city_code);

      if (newRegionCode !== org.region_code || newCityCode !== org.city_code) {
        await prisma.organizations.update({
          where: { id: org.id },
          data: {
            region_code: newRegionCode,
            city_code: newCityCode
          }
        });
        orgUpdated++;
        console.log(`   ✅ ${org.name}: ${org.region_code}→${newRegionCode}, ${org.city_code}→${newCityCode}`);
      }
    }
    console.log(`   조직 업데이트: ${orgUpdated}/${organizations.length}개\n`);

    // 3. 사용자와 조직 간 일치성 확인
    console.log('🔍 사용자-조직 지역 코드 일치성 확인...');
    const usersWithOrg = await prisma.user_profiles.findMany({
      where: {
        organization_id: { not: null },
        is_active: true
      },
      include: {
        organizations: {
          select: {
            name: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    let mismatchCount = 0;
    for (const user of usersWithOrg) {
      if (user.organizations &&
          user.region_code !== user.organizations.region_code) {
        mismatchCount++;
        console.log(`   ⚠️ ${user.full_name}: 사용자(${user.region_code}) ≠ 조직(${user.organizations.region_code})`);

        // 사용자 코드를 조직에 맞춰 업데이트
        await prisma.user_profiles.update({
          where: { id: user.id },
          data: {
            region_code: user.organizations.region_code
          }
        });
        console.log(`      → 사용자 코드를 조직에 맞춰 업데이트 완료`);
      }
    }

    console.log(`\n📊 정규화 결과:`);
    console.log(`   사용자 업데이트: ${userUpdated}명`);
    console.log(`   조직 업데이트: ${orgUpdated}개`);
    console.log(`   불일치 수정: ${mismatchCount}건`);

  } catch (error) {
    console.error('❌ 정규화 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
normalizeRegionCodes()
  .then(() => {
    console.log('\n✅ 지역 코드 정규화 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 예상치 못한 오류:', error);
    process.exit(1);
  });