#!/usr/bin/env npx tsx

/**
 * 완전한 City Code 매핑 생성
 * 복합 행정구역 문제 해결
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateCompleteMapping() {
  try {
    // 모든 조직 데이터 가져오기
    const orgs = await prisma.$queryRaw<
      Array<{ city_code: string; name: string; region_code: string }>
    >`
      SELECT DISTINCT city_code, name, region_code
      FROM organizations
      WHERE city_code IS NOT NULL
      ORDER BY region_code, city_code
    `;

    // city_code별로 그룹화
    const grouped = new Map<string, Set<string>>();

    for (const org of orgs) {
      if (!grouped.has(org.city_code)) {
        grouped.set(org.city_code, new Set());
      }
      grouped.get(org.city_code)!.add(org.name);
    }

    // 매핑 생성 (복합 행정구역 처리)
    const finalMapping: Array<[string, string, string]> = [];

    // 특수 케이스 처리
    const specialCases: Record<string, string> = {
      // 수원시 구
      'suwon': '수원시',  // 상위 매핑
      'suwon_jangan': '장안구',
      'suwon_gwonseon': '권선구',
      'suwon_yeongtong': '영통구',
      'suwon_paldal': '팔달구',

      // 성남시 구
      'seongnam': '성남시',
      'seongnam_sujeong': '수정구',
      'seongnam_jungwon': '중원구',
      'seongnam_bundang': '분당구',

      // 고양시 구
      'goyang': '고양시',
      'goyang_deogyang': '덕양구',
      'goyang_ilsandong': '일산동구',
      'goyang_ilsanseo': '일산서구',

      // 용인시 구
      'yongin': '용인시',
      'yongin_cheoin': '처인구',
      'yongin_giheung': '기흥구',
      'yongin_suji': '수지구',

      // 청주시 구
      'cheongju': '청주시',
      'cheongju-sangdang': '상당구',
      'cheongju-seowon': '서원구',
      'cheongju-heungdeok': '흥덕구',
      'cheongju-cheongwon': '청원구',

      // 천안시 구
      'cheonan': '천안시',
      'cheonan_dongnam': '동남구',
      'cheonan_seobuk': '서북구',

      // 전주시 구
      'jeonju': '전주시',
      'jeonju_wansan': '완산구',
      'jeonju_deokjin': '덕진구',

      // 포항시 구
      'pohang': '포항시',
      'pohang_nam': '남구',
      'pohang_buk': '북구',

      // 창원시 구
      'changwon': '창원시',
      'changwon_uichang': '의창구',
      'changwon_seongsan': '성산구',
      'changwon_masanhappo': '마산합포구',
      'changwon_masanhoewon': '마산회원구',
      'changwon_jinhae': '진해구',

      // 안산시 구
      'ansan': '안산시',
      'ansan_danwon': '단원구',
      'ansan_sangnok': '상록구',

      // 안양시 구
      'anyang': '안양시',
      'anyang_manan': '만안구',
      'anyang_dongan': '동안구',

      // 특수 보건소
      'namyangju_pungyang': '남양주시',  // 풍양보건소
      'hwaseong_dongtan': '화성시',  // 동탄보건소
      'gangseo_gadeok': '강서구',  // 가덕보건소
      'tongyeong_yokji': '통영시',  // 욕지보건소
    };

    for (const [cityCode, orgNames] of grouped.entries()) {
      const orgNameArray = Array.from(orgNames);
      const firstOrg = orgNameArray[0];

      // 특수 케이스 체크
      if (specialCases[cityCode]) {
        const regionCode = orgs.find(o => o.city_code === cityCode)?.region_code || '';
        finalMapping.push([cityCode, specialCases[cityCode], regionCode]);
        continue;
      }

      // 일반 패턴 추출
      let gugun: string | null = null;

      // 패턴 1: "XX구 보건소"
      const pattern1 = firstOrg.match(/([가-힣]+(?:구|군|시))(?:\s*보건소)?/);
      if (pattern1) {
        gugun = pattern1[1];
      }

      // 패턴 2: 복합 행정구역
      const pattern2 = firstOrg.match(/(?:수원시|성남시|고양시|용인시|청주시|천안시|전주시|포항시|창원시|안산시|안양시)\s*([가-힣]+구)/);
      if (pattern2) {
        gugun = pattern2[1];
      }

      if (gugun) {
        const regionCode = orgs.find(o => o.city_code === cityCode)?.region_code || '';
        finalMapping.push([cityCode, gugun, regionCode]);
      }
    }

    // 출력
    console.log(`// 총 ${finalMapping.length}개 매핑\n`);
    console.log('export const CITY_CODE_TO_GUGUN_MAP: Record<string, string> = {');

    // 지역별로 그룹화
    const byRegion = new Map<string, Array<[string, string]>>();
    for (const [code, gugun, region] of finalMapping) {
      if (!byRegion.has(region)) {
        byRegion.set(region, []);
      }
      byRegion.get(region)!.push([code, gugun]);
    }

    // 지역 순서
    const regionOrder = [
      'SEO', 'BUS', 'DAE', 'INC', 'GWA', 'DAJ', 'ULS', 'SEJ',
      'GYE', 'GAN', 'CHB', 'CHN', 'JEB', 'JEN', 'GYB', 'GYN', 'JEJ'
    ];

    const regionNames: Record<string, string> = {
      'SEO': '서울특별시',
      'BUS': '부산광역시',
      'DAE': '대구광역시',
      'INC': '인천광역시',
      'GWA': '광주광역시',
      'DAJ': '대전광역시',
      'ULS': '울산광역시',
      'SEJ': '세종특별자치시',
      'GYE': '경기도',
      'GAN': '강원특별자치도',
      'CHB': '충청북도',
      'CHN': '충청남도',
      'JEB': '전북특별자치도',
      'JEN': '전라남도',
      'GYB': '경상북도',
      'GYN': '경상남도',
      'JEJ': '제주특별자치도'
    };

    for (const region of regionOrder) {
      const items = byRegion.get(region);
      if (!items || items.length === 0) continue;

      console.log(`  // ${regionNames[region] || region}`);
      for (const [code, gugun] of items.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  '${code}': '${gugun}',`);
      }
      console.log('');
    }

    console.log('};');

    // 매핑 실패 확인
    const unmapped = orgs.filter(o =>
      !finalMapping.some(([code]) => code === o.city_code) &&
      !specialCases[o.city_code]
    );

    if (unmapped.length > 0) {
      console.log('\n// 매핑 실패 (수동 확인 필요)');
      for (const org of unmapped) {
        console.log(`// '${org.city_code}': '???',  // ${org.name}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateCompleteMapping().catch(console.error);