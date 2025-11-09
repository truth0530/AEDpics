/**
 * 중앙집중식 조직 데이터 생성 팩토리 (2025-11-09)
 *
 * 지역별 조직(응급의료지원센터, 보건소) 데이터를 일관되게 생성합니다.
 * 모든 지역명 하드코딩을 제거하고 중앙 시스템에서 통합 관리합니다.
 *
 * 구조:
 * - RegionOrgData: Factory의 반환 타입 (region, regionCode, fullRegionName, organizations, guguns)
 * - generateRegionOrganizations(): 모든 지역의 조직 데이터 생성
 * - generateOrganizationsForRegion(): 특정 지역의 조직 배열 생성
 */

import {
  REGIONS,
  REGION_CODE_TO_GUGUNS,
  getEmergencyCenterName,
  generateHealthCenterName,
  getFullRegionName
} from '@/lib/constants/regions';

/**
 * Factory에서 반환하는 지역별 조직 데이터
 *
 * 구조:
 * - region: 짧은 지역명 (예: '서울', '부산') - 키(KEY)로 사용됨
 * - regionCode: 지역 코드 (예: 'SEO', 'BUS')
 * - fullRegionName: 정식 지역명 (예: '서울특별시', '부산광역시')
 * - organizations: 조직명 배열 [기타, 응급의료지원센터, 보건소1, 보건소2, ...]
 * - guguns: 구군명 배열 (seed 스크립트에서 city_code 추출용)
 */
export interface RegionOrgData {
  region: string;  // 짧은 이름: '서울', '부산' (KEY로 사용됨)
  regionCode: string;  // 'SEO', 'BUS' (코드)
  fullRegionName: string;  // '서울특별시', '부산광역시' (정식명칭)
  organizations: string[];  // 조직명 배열
  guguns: string[];  // 구군 목록 (seed에서 city_code 추출용)
}

/**
 * 특정 지역의 조직명 배열 생성
 *
 * 구조:
 * [
 *   '기타 (직접 입력)',           // Index 0 - Fallback 항목
 *   '${짧은명}응급의료지원센터',   // Index 1 - 응급의료지원센터
 *   '${정식명} ${구군1} 보건소',   // Index 2+ - 보건소들
 *   '${정식명} ${구군2} 보건소',
 *   ...
 * ]
 *
 * @param regionCode - 지역 코드 (예: 'SEO', 'DAE')
 * @returns 해당 지역의 조직명 배열
 *
 * @example
 * generateOrganizationsForRegion('SEO')
 * // [
 * //   '기타 (직접 입력)',
 * //   '서울응급의료지원센터',
 * //   '서울특별시 종로구 보건소',
 * //   '서울특별시 중구 보건소',
 * //   ...
 * // ]
 */
function generateOrganizationsForRegion(regionCode: string): string[] {
  const guguns = REGION_CODE_TO_GUGUNS[regionCode] || [];

  // 기타 (직접 입력) 항목으로 시작
  const orgs = ['기타 (직접 입력)'];

  // 응급의료지원센터 추가
  orgs.push(getEmergencyCenterName(regionCode));

  // 각 구군별 보건소 추가
  guguns.forEach(gugun => {
    orgs.push(generateHealthCenterName(regionCode, gugun));
  });

  return orgs;
}

/**
 * 전체 지역의 조직 데이터 생성
 *
 * 모든 지역(중앙 포함 17개 시도)에 대해 RegionOrgData 배열을 반환합니다.
 * Prisma seed 스크립트와 health-centers-master.ts에서 사용됩니다.
 *
 * @returns RegionOrgData 배열 (17개 - 중앙 포함)
 *
 * @example
 * const allRegions = generateRegionOrganizations();
 * allRegions.length // 17
 * allRegions[0]     // { region: '중앙', regionCode: 'KR', ... }
 * allRegions[1]     // { region: '서울', regionCode: 'SEO', ... }
 */
export function generateRegionOrganizations(): RegionOrgData[] {
  return REGIONS.map(region => ({
    region: region.label,  // 짧은 이름 (KEY)
    regionCode: region.code,
    fullRegionName: getFullRegionName(region.code),
    organizations: generateOrganizationsForRegion(region.code),
    guguns: REGION_CODE_TO_GUGUNS[region.code] || []
  }));
}

/**
 * Factory 함수 검증 (개발/테스트용)
 *
 * RegionOrgData 배열이 올바르게 생성되었는지 검증합니다.
 * 5가지 검증 항목:
 * 1. 18개 지역 반환 (중앙 + 17개 시도)
 * 2. guguns 배열이 REGION_CODE_TO_GUGUNS와 정확히 매칭
 * 3. region 필드는 항상 짧은 명칭 (KEY)
 * 4. organizations[0] === '기타 (직접 입력)'
 * 5. organizations.length == (1 + 1 + guguns.length)
 *
 * @throws Error - 검증 실패 시 에러 메시지
 */
export function validateRegionOrgData(): void {
  const data = generateRegionOrganizations();

  console.log('[RegionOrgData 검증 시작]');

  // 검증 1: 18개 지역 (중앙 + 17개 시도)
  if (data.length !== 18) {
    throw new Error(
      `검증 1 실패: 18개 지역이 필요하지만 ${data.length}개가 반환됨`
    );
  }
  console.log('✓ 검증 1: 18개 지역 반환됨 (중앙 + 17개 시도)');

  // 각 지역 개별 검증
  data.forEach((region, index) => {
    const regionLabel = `${region.region}(${region.regionCode})`;

    // 검증 2: guguns 배열 매칭
    const expectedGuguns = REGION_CODE_TO_GUGUNS[region.regionCode] || [];
    if (JSON.stringify(region.guguns) !== JSON.stringify(expectedGuguns)) {
      throw new Error(
        `검증 2 실패 [${regionLabel}]: guguns 배열이 매칭되지 않음`
      );
    }

    // 검증 3: region 필드는 짧은 명칭
    const expectedRegion = REGIONS.find(r => r.code === region.regionCode)?.label;
    if (region.region !== expectedRegion) {
      throw new Error(
        `검증 3 실패 [${regionLabel}]: region 필드가 짧은 명칭이 아님`
      );
    }

    // 검증 4: organizations[0] === '기타 (직접 입력)'
    if (region.organizations[0] !== '기타 (직접 입력)') {
      throw new Error(
        `검증 4 실패 [${regionLabel}]: organizations[0]이 '기타 (직접 입력)'이 아님`
      );
    }

    // 검증 5: 길이 확인 (1 + 1 + guguns.length)
    const expectedLength = 1 + 1 + region.guguns.length;
    if (region.organizations.length !== expectedLength) {
      throw new Error(
        `검증 5 실패 [${regionLabel}]: organizations 길이가 ${expectedLength}이어야 하는데 ${region.organizations.length}임`
      );
    }
  });

  console.log('✓ 검증 2-5: 모든 지역이 올바른 구조 확인');
  console.log('[RegionOrgData 검증 완료 ✓]');
}
