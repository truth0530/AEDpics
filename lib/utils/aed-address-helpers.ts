/**
 * AED 주소 관련 헬퍼 함수
 *
 * 목적: COALESCE 로직 중복 제거 및 주소 필드 표준화
 * 배경: 여러 API에서 동일한 COALESCE 로직을 반복 사용하여 유지보수성 저하
 */

import { addressFallback, addressFallbackWithDefault } from './null-helpers';

/**
 * SQL 쿼리용 주소 COALESCE 표현식 생성
 *
 * 사용 시기:
 * - Raw SQL 쿼리에서 주소 필드를 선택할 때
 * - COALESCE 로직을 표준화하고 싶을 때
 *
 * @param tableAlias 테이블 별칭 (default: 'ad')
 * @param columnAlias 결과 컬럼 별칭 (default: 'address')
 * @returns SQL COALESCE 표현식
 *
 * @example
 * getSqlAddressCoalesce()
 * // 'COALESCE(ad.installation_location_address, ad.installation_address) as address'
 *
 * getSqlAddressCoalesce('a', 'full_address')
 * // 'COALESCE(a.installation_location_address, a.installation_address) as full_address'
 *
 * // 사용 예시:
 * const query = `
 *   SELECT
 *     ad.management_number,
 *     ${getSqlAddressCoalesce('ad')}
 *   FROM aedpics.aed_data ad
 * `;
 */
export function getSqlAddressCoalesce(
  tableAlias: string = 'ad',
  columnAlias: string = 'address'
): string {
  return `COALESCE(${tableAlias}.installation_location_address, ${tableAlias}.installation_address) as ${columnAlias}`;
}

/**
 * SQL 쿼리용 위치 COALESCE 표현식 생성
 *
 * 사용 시기:
 * - Raw SQL 쿼리에서 설치 위치를 선택할 때
 *
 * @param tableAlias 테이블 별칭 (default: 'ad')
 * @param columnAlias 결과 컬럼 별칭 (default: 'position')
 * @returns SQL COALESCE 표현식
 *
 * @example
 * getSqlPositionCoalesce()
 * // "COALESCE(ad.installation_position, '') as position"
 *
 * getSqlPositionCoalesce('a', 'location')
 * // "COALESCE(a.installation_position, '') as location"
 */
export function getSqlPositionCoalesce(
  tableAlias: string = 'ad',
  columnAlias: string = 'position'
): string {
  return `COALESCE(${tableAlias}.installation_position, '') as ${columnAlias}`;
}

/**
 * AED 객체에서 표시용 주소 추출
 *
 * 사용 시기:
 * - Prisma 쿼리 결과에서 주소를 표시할 때
 * - API 응답을 구성할 때
 *
 * @param aed AED 데이터 객체
 * @returns 유효한 주소 또는 null
 *
 * @example
 * const aed = {
 *   installation_location_address: '대구광역시 중구 동덕로 167',
 *   installation_address: '대구광역시 중구 동산동'
 * };
 * getDisplayAddress(aed);  // '대구광역시 중구 동덕로 167'
 *
 * const aed2 = {
 *   installation_location_address: null,
 *   installation_address: '대구광역시 중구 동산동'
 * };
 * getDisplayAddress(aed2);  // '대구광역시 중구 동산동'
 */
export function getDisplayAddress(aed: {
  installation_location_address?: string | null;
  installation_address?: string | null;
}): string | null {
  return addressFallback(
    aed.installation_location_address,
    aed.installation_address
  );
}

/**
 * AED 객체에서 표시용 주소 추출 (기본값 포함)
 *
 * @param aed AED 데이터 객체
 * @param defaultValue 기본값 (default: '주소 미등록')
 * @returns 유효한 주소 (항상 string 반환)
 *
 * @example
 * const aed = {
 *   installation_location_address: null,
 *   installation_address: null
 * };
 * getDisplayAddressWithDefault(aed);  // '주소 미등록'
 * getDisplayAddressWithDefault(aed, '-');  // '-'
 */
export function getDisplayAddressWithDefault(
  aed: {
    installation_location_address?: string | null;
    installation_address?: string | null;
  },
  defaultValue: string = '주소 미등록'
): string {
  return addressFallbackWithDefault(
    aed.installation_location_address,
    aed.installation_address,
    defaultValue
  );
}

/**
 * AED 주소 정보를 포함한 객체 반환
 *
 * 사용 시기:
 * - API 응답에서 주소 관련 메타데이터가 필요할 때
 * - 어떤 주소 필드가 사용되었는지 추적해야 할 때
 *
 * @param aed AED 데이터 객체
 * @returns 주소 및 메타데이터
 *
 * @example
 * const aed = {
 *   installation_location_address: '대구광역시 중구 동덕로 167',
 *   installation_address: '대구광역시 중구 동산동'
 * };
 * formatAEDAddress(aed);
 * // {
 * //   address: '대구광역시 중구 동덕로 167',
 * //   hasLocationAddress: true,
 * //   hasInstallationAddress: true,
 * //   usedLocationAddress: true
 * // }
 */
export function formatAEDAddress(aed: {
  installation_location_address?: string | null;
  installation_address?: string | null;
}): {
  address: string | null;
  hasLocationAddress: boolean;
  hasInstallationAddress: boolean;
  usedLocationAddress: boolean;
} {
  const locationAddress = aed.installation_location_address?.trim();
  const installationAddress = aed.installation_address?.trim();

  return {
    address: addressFallback(
      aed.installation_location_address,
      aed.installation_address
    ),
    hasLocationAddress: !!locationAddress,
    hasInstallationAddress: !!installationAddress,
    usedLocationAddress: !!locationAddress,
  };
}

/**
 * SQL IN 절용 주소 검색 조건 생성
 *
 * 사용 시기:
 * - 복잡한 주소 검색 쿼리를 구성할 때
 *
 * @param searchTerm 검색어
 * @param tableAlias 테이블 별칭 (default: 'ad')
 * @param paramIndex 파라미터 인덱스 (default: 1)
 * @returns SQL WHERE 조건 배열 및 파라미터
 *
 * @example
 * const { conditions, params } = getSqlAddressSearchConditions('동덕로', 'a', 5);
 * // conditions: [
 * //   'a.installation_address ILIKE $5',
 * //   'a.installation_location_address ILIKE $5'
 * // ]
 * // params: ['%동덕로%']
 */
export function getSqlAddressSearchConditions(
  searchTerm: string,
  tableAlias: string = 'ad',
  paramIndex: number = 1
): {
  conditions: string[];
  params: string[];
} {
  const param = `%${searchTerm}%`;

  return {
    conditions: [
      `${tableAlias}.installation_address ILIKE $${paramIndex}`,
      `${tableAlias}.installation_location_address ILIKE $${paramIndex}`,
    ],
    params: [param],
  };
}

/**
 * Prisma OR 조건용 주소 검색 객체 생성
 *
 * 사용 시기:
 * - Prisma 쿼리에서 주소 검색 조건을 추가할 때
 *
 * @param searchTerm 검색어
 * @returns Prisma OR 조건 배열
 *
 * @example
 * const whereConditions = {
 *   OR: [
 *     { management_number: { contains: search, mode: 'insensitive' } },
 *     ...getPrismaAddressSearchConditions(search)
 *   ]
 * };
 */
export function getPrismaAddressSearchConditions(searchTerm: string): Array<{
  [key: string]: { contains: string; mode: 'insensitive' };
}> {
  return [
    { installation_address: { contains: searchTerm, mode: 'insensitive' } },
    { installation_location_address: { contains: searchTerm, mode: 'insensitive' } },
  ];
}
