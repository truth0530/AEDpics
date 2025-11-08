/**
 * 보건소 및 지역 마스터 데이터 (Phase 1 개선 - 2025-11-09)
 *
 * 이 파일은 중앙집중식 orgFactory를 통해 모든 지역/보건소 데이터를 동적으로 가져옵니다.
 * 더 이상 하드코딩된 데이터를 유지할 필요가 없습니다.
 *
 * 구조:
 * - generateRegionOrganizations()를 통해 동적 데이터 생성
 * - HEALTH_CENTERS_BY_REGION은 HealthCenterData[] 형식으로 변환
 * - region 필드는 단축명(SHORT name) 사용 (KEY 일관성)
 *
 * 마이그레이션 타이밍:
 * - Seed 스크립트와 UI 폼은 이미 orgFactory 호환 설계됨
 * - health-centers-master.ts 업데이트는 fallback 역할만 수행
 */

import { generateRegionOrganizations } from '@/lib/services/orgFactory';

export interface HealthCenterData {
  region: string;  // 짧은 이름 (KEY): '서울', '부산', ... ✅ 중앙관리 시스템 준수
  centers: string[];  // 조직명 배열
}

/**
 * 동적으로 지역별 보건소 마스터 데이터 생성
 *
 * orgFactory에서 모든 지역의 조직 데이터를 가져와
 * HealthCenterData 형식으로 변환합니다.
 *
 * @returns 지역별 보건소 데이터 배열
 */
function generateHealthCenterData(): HealthCenterData[] {
  const regionOrgData = generateRegionOrganizations();

  return regionOrgData
    // 중앙(KR)은 제외 - 보건소 목록에서 불필요
    .filter(data => data.regionCode !== 'KR')
    .map(data => ({
      region: data.region,  // 짧은 이름 사용 (KEY)
      centers: data.organizations
    }));
}

/**
 * 지역별 보건소 마스터 데이터 (Fallback)
 *
 * 모든 지역/보건소 데이터가 orgFactory에서 동적으로 생성됩니다.
 * 데이터베이스가 업데이트 중이거나 접근 불가능할 때 fallback으로 사용됩니다.
 */
export const HEALTH_CENTERS_BY_REGION: HealthCenterData[] = generateHealthCenterData();

/**
 * 가용 지역 목록 (드롭다운용)
 *
 * @returns 지역명 배열 (단축명: '서울', '부산', ...)
 *
 * @example
 * getAvailableRegions() // ['서울', '부산', '대구', ...]
 */
export function getAvailableRegions(): string[] {
  return HEALTH_CENTERS_BY_REGION.map(data => data.region);
}

/**
 * 특정 지역의 가용 보건소 목록 (드롭다운용)
 *
 * @param region - 지역명 (단축명: '서울', '부산', ...)
 * @returns 해당 지역의 조직명 배열
 *
 * @example
 * getAvailableCenters('서울')
 * // ['기타 (직접 입력)', '서울응급의료지원센터', '서울특별시 종로구 보건소', ...]
 */
export function getAvailableCenters(region: string): string[] {
  return HEALTH_CENTERS_BY_REGION.find(data => data.region === region)?.centers || [];
}

/**
 * 지역 코드로 보건소 목록 조회
 *
 * @param regionCode - 지역 코드 ('SEO', 'BUS', ...)
 * @returns 해당 지역의 조직명 배열
 *
 * @example
 * getOrganizationsByRegionCode('SEO') // 서울 보건소 목록
 */
export function getOrganizationsByRegionCode(regionCode: string): string[] {
  const regionOrgData = generateRegionOrganizations();
  return regionOrgData.find(data => data.regionCode === regionCode)?.organizations || [];
}

/**
 * 모든 보건소 목록 (검색용)
 *
 * @returns 전체 보건소명 배열
 */
export function getAllHealthCenters(): string[] {
  return HEALTH_CENTERS_BY_REGION.flatMap(data => data.centers);
}
