/**
 * 지역별 소속기관 데이터 (Phase 2 개선 - 2025-11-09)
 *
 * 이 파일은 중앙집중식 orgFactory를 통해 모든 지역/조직 데이터를 동적으로 가져옵니다.
 * 더 이상 487줄의 하드코딩된 데이터를 유지할 필요가 없습니다.
 *
 * 구조:
 * - generateRegionOrganizations()를 통해 동적 데이터 생성
 * - regionOrganizations는 RegionOrganization[] 형식으로 변환
 * - region 필드는 단축명(SHORT name) 사용 (KEY 일관성: '서울', '부산', ...)
 *
 * 호환성:
 * - getOrganizationsByRegion('서울') 호출 완벽 호환
 * - 회원가입 페이지 드롭다운 자동 갱신
 */

import { generateRegionOrganizations } from '@/lib/services/orgFactory';

export interface RegionOrganization {
  region: string;  // 단축명 (KEY): '서울', '부산', ... ✅ 중앙관리 시스템 준수
  organizations: string[];  // 조직명 배열
}

/**
 * 동적으로 지역별 조직 데이터 생성
 *
 * orgFactory에서 모든 지역의 조직 데이터를 가져와
 * RegionOrganization 형식으로 변환합니다.
 *
 * @returns 지역별 조직 데이터 배열
 */
function generateRegionOrganizationData(): RegionOrganization[] {
  const regionOrgData = generateRegionOrganizations();

  return regionOrgData.map(data => ({
    region: data.region,  // 단축명 사용 (KEY)
    organizations: data.organizations
  }));
}

/**
 * 지역별 조직 마스터 데이터 (동적 생성)
 *
 * 모든 지역/조직 데이터가 orgFactory에서 동적으로 생성됩니다.
 * 487줄의 하드코딩된 데이터가 30줄로 축소되었습니다.
 */
export const regionOrganizations: RegionOrganization[] = generateRegionOrganizationData();

/**
 * 특정 지역의 조직 목록 조회
 *
 * @param region - 지역명 (단축명: '서울', '부산', ...)
 * @returns 해당 지역의 조직명 배열
 *
 * @example
 * getOrganizationsByRegion('서울')
 * // ['기타 (직접 입력)', '서울응급의료지원센터', '서울특별시 종로구 보건소', ...]
 */
export const getOrganizationsByRegion = (region: string): string[] => {
  const regionData = regionOrganizations.find(r => r.region === region);
  return regionData?.organizations || [];
};

/**
 * 이메일 기반 가용 지역 목록 조회 (회원가입 폴백용)
 *
 * 이메일 도메인에 따라 접근 가능한 지역이 결정됩니다:
 * - @nmc.or.kr (응급의료센터): 모든 지역 + 중앙
 * - @korea.kr (정부): 모든 지역 (중앙 제외)
 * - 그 외 (임시 점검원): 모든 지역 (중앙 제외)
 *
 * @param email - 사용자 이메일 주소
 * @returns 접근 가능한 지역 목록
 *
 * @example
 * getAvailableRegions('user@nmc.or.kr') // ['중앙', '서울', '부산', ...]
 * getAvailableRegions('user@korea.kr') // ['서울', '부산', ...] (중앙 제외)
 */
export const getAvailableRegions = (email: string): string[] => {
  const domain = email?.split('@')[1]?.toLowerCase() || '';
  const allRegions = regionOrganizations.map(r => r.region);

  // nmc.or.kr은 중앙 포함 모든 지역 접근 가능
  if (domain === 'nmc.or.kr') {
    return allRegions;
  }

  // korea.kr 또는 그 외는 중앙 제외
  return allRegions.filter(r => r !== '중앙');
};

/**
 * 이메일 도메인과 지역 기반 조직 목록 조회 (회원가입 폴백용)
 *
 * @param email - 사용자 이메일 주소
 * @param region - 선택한 지역명 (단축명: '서울', '부산', ...)
 * @returns 해당 지역의 조직명 배열
 *
 * @example
 * getOrganizationsByEmailDomain('user@korea.kr', '서울')
 * // ['기타 (직접 입력)', '서울응급의료지원센터', '서울특별시 종로구 보건소', ...]
 */
export const getOrganizationsByEmailDomain = (email: string, region: string): string[] => {
  return getOrganizationsByRegion(region);
};
