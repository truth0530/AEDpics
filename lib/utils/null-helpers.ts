/**
 * null/undefined/빈 문자열 체크 유틸리티
 *
 * 목적: 프로젝트 전체에서 일관된 fallback 로직 사용
 * 배경: ||, ??, if 문 혼용으로 인한 예측 불가능한 동작 방지
 */

/**
 * 주소 필드 Fallback (빈 문자열도 무효로 간주)
 *
 * 사용 시기:
 * - installation_address, installation_location_address 등 주소 필드
 * - 빈 문자열('')을 null과 동일하게 처리해야 하는 경우
 *
 * @param primary 우선 값
 * @param fallback 대체 값
 * @returns 유효한 문자열 또는 null
 *
 * @example
 * addressFallback('', '서울특별시 강남구')  // '서울특별시 강남구'
 * addressFallback('  ', '서울특별시 강남구')  // '서울특별시 강남구' (trim 후 빈 문자열)
 * addressFallback(null, '서울특별시 강남구')  // '서울특별시 강남구'
 * addressFallback(undefined, '서울특별시 강남구')  // '서울특별시 강남구'
 * addressFallback('대구광역시 중구', '서울특별시 강남구')  // '대구광역시 중구'
 * addressFallback(null, null)  // null
 */
export function addressFallback(
  primary: string | null | undefined,
  fallback: string | null | undefined
): string | null {
  // 빈 문자열, null, undefined 모두 무효 처리
  const validPrimary = primary?.trim();
  const validFallback = fallback?.trim();

  if (validPrimary) return validPrimary;
  if (validFallback) return validFallback;
  return null;
}

/**
 * 주소 필드 표시용 Fallback (기본값 포함)
 *
 * 사용 시기:
 * - UI 표시용 주소 (null을 허용하지 않는 경우)
 * - API 응답에서 기본값이 필요한 경우
 *
 * @param primary 우선 값
 * @param fallback 대체 값
 * @param defaultValue 기본값 (default: '주소 미등록')
 * @returns 유효한 문자열 (항상 string 반환)
 *
 * @example
 * addressFallbackWithDefault('', '')  // '주소 미등록'
 * addressFallbackWithDefault(null, null, '-')  // '-'
 * addressFallbackWithDefault('대구광역시 중구', '')  // '대구광역시 중구'
 */
export function addressFallbackWithDefault(
  primary: string | null | undefined,
  fallback: string | null | undefined,
  defaultValue: string = '주소 미등록'
): string {
  return addressFallback(primary, fallback) || defaultValue;
}

/**
 * 지역 코드 Fallback (null/undefined만 무효, 빈 문자열은 유효)
 *
 * 사용 시기:
 * - region_code, city_code 등 코드 필드
 * - 빈 문자열('')이 유효한 값일 수 있는 경우
 *
 * @param value 값
 * @returns 유효한 문자열 또는 undefined
 *
 * @example
 * regionCodeFallback('SEO')  // 'SEO'
 * regionCodeFallback('')  // '' (빈 문자열도 유효한 코드로 간주)
 * regionCodeFallback(null)  // undefined
 * regionCodeFallback(undefined)  // undefined
 *
 * @note
 * 이 함수는 ?? 연산자와 동일하게 동작하지만, 명시적으로 의도를 표현
 * const code = regionCodeFallback(value);  // 명확한 의도
 * const code = value ?? undefined;  // 의도가 불분명
 */
export function regionCodeFallback(
  value: string | null | undefined
): string | undefined {
  // null과 undefined만 무효 처리, 빈 문자열은 유효
  return value ?? undefined;
}

/**
 * 다중 Fallback (첫 번째 유효한 값 반환)
 *
 * 사용 시기:
 * - 3개 이상의 fallback 값이 필요한 경우
 *
 * @param values 우선순위 순서로 정렬된 값 배열
 * @returns 첫 번째 유효한 값 또는 null
 *
 * @example
 * multipleFallback(['', null, '서울특별시'])  // '서울특별시'
 * multipleFallback(['대구광역시', '서울특별시', '부산광역시'])  // '대구광역시'
 * multipleFallback([null, null, null])  // null
 */
export function multipleFallback(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * 다중 Fallback (기본값 포함)
 *
 * @param defaultValue 모든 값이 무효일 때 반환할 기본값
 * @param values 우선순위 순서로 정렬된 값 배열
 * @returns 첫 번째 유효한 값 또는 기본값
 *
 * @example
 * multipleFallbackWithDefault('미등록', '', null, undefined)  // '미등록'
 * multipleFallbackWithDefault('-', '대구광역시', '서울특별시')  // '대구광역시'
 */
export function multipleFallbackWithDefault(
  defaultValue: string,
  ...values: Array<string | null | undefined>
): string {
  return multipleFallback(...values) || defaultValue;
}

/**
 * 안전한 문자열 변환 (null-safe)
 *
 * 사용 시기:
 * - DB에서 가져온 값을 문자열로 보장해야 할 때
 * - 타입 안정성이 필요한 경우
 *
 * @param value 변환할 값
 * @param defaultValue 기본값 (default: '')
 * @returns 문자열 (항상 string 반환)
 *
 * @example
 * safeString(null)  // ''
 * safeString(undefined)  // ''
 * safeString('hello')  // 'hello'
 * safeString(null, '-')  // '-'
 */
export function safeString(
  value: string | null | undefined,
  defaultValue: string = ''
): string {
  return value ?? defaultValue;
}

/**
 * 빈 문자열을 null로 정규화
 *
 * 사용 시기:
 * - DB 저장 전 정규화
 * - 빈 문자열을 null로 통일하고 싶을 때
 *
 * @param value 정규화할 값
 * @returns 유효한 문자열 또는 null
 *
 * @example
 * normalizeEmptyToNull('')  // null
 * normalizeEmptyToNull('  ')  // null (trim 후 빈 문자열)
 * normalizeEmptyToNull('hello')  // 'hello'
 * normalizeEmptyToNull(null)  // null
 */
export function normalizeEmptyToNull(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}
