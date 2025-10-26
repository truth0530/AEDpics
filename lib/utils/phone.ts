/**
 * 한국 전화번호 유틸리티 함수
 *
 * 지원하는 형식:
 * - 휴대폰: 010-1234-5678, 011-123-4567
 * - 서울: 02-1234-5678, 02-123-4567
 * - 지역번호: 031-1234-5678, 051-123-4567
 */

/**
 * 전화번호 자동 포맷팅
 * @param value 입력값 (숫자만 추출하여 처리)
 * @returns 포맷팅된 전화번호
 */
export function formatPhoneNumber(value: string): string {
  // 숫자만 추출
  const numbers = value.replace(/\D/g, '');

  if (numbers.length === 0) return '';

  // 서울(02)인 경우
  if (numbers.startsWith('02')) {
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 5) {
      // 02-123 or 02-1234
      return `02-${numbers.slice(2)}`;
    } else if (numbers.length <= 9) {
      // 02-123-4567 (3자리-4자리)
      return `02-${numbers.slice(2, 5)}-${numbers.slice(5, 9)}`;
    } else {
      // 02-1234-5678 (4자리-4자리)
      return `02-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }
  }

  // 휴대폰 (010, 011, 016, 017, 018, 019)
  if (numbers.startsWith('01')) {
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  }

  // 지역번호 (031, 032, 033, 041, 042, 043, 051, 052, 053, 054, 055, 061, 062, 063, 064)
  if (numbers.startsWith('0')) {
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 6) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  }

  return numbers;
}

/**
 * 전화번호 유효성 검증
 * @param phone 전화번호 (하이픈 포함 가능)
 * @returns 유효한 경우 true
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return true; // 선택사항인 경우

  // 숫자만 추출
  const numbers = phone.replace(/\D/g, '');

  // 서울 (02)
  if (numbers.startsWith('02')) {
    // 02-123-4567 (9자리) 또는 02-1234-5678 (10자리)
    return numbers.length === 9 || numbers.length === 10;
  }

  // 휴대폰 (010, 011, 016, 017, 018, 019)
  if (/^01[0-9]/.test(numbers)) {
    // 010-1234-5678 (11자리) 또는 011-123-4567 (10자리)
    return numbers.length === 10 || numbers.length === 11;
  }

  // 지역번호 (031~064)
  if (/^0[3-9][0-9]/.test(numbers)) {
    // 031-123-4567 (10자리) 또는 031-1234-5678 (11자리)
    return numbers.length === 10 || numbers.length === 11;
  }

  return false;
}

/**
 * 전화번호 에러 메시지 생성
 * @param phone 전화번호
 * @returns 에러 메시지 또는 null
 */
export function getPhoneErrorMessage(phone: string): string | null {
  if (!phone) return null;

  const numbers = phone.replace(/\D/g, '');

  if (numbers.startsWith('02')) {
    if (numbers.length < 9) {
      return '서울 전화번호는 최소 9자리입니다. (예: 02-123-4567 또는 02-1234-5678)';
    }
    if (numbers.length > 10) {
      return '서울 전화번호는 최대 10자리입니다.';
    }
  } else if (/^01[0-9]/.test(numbers)) {
    if (numbers.length < 10) {
      return '휴대폰 번호는 최소 10자리입니다. (예: 010-1234-5678)';
    }
    if (numbers.length > 11) {
      return '휴대폰 번호는 최대 11자리입니다.';
    }
  } else if (/^0[3-9][0-9]/.test(numbers)) {
    if (numbers.length < 10) {
      return '지역 전화번호는 최소 10자리입니다. (예: 031-123-4567)';
    }
    if (numbers.length > 11) {
      return '지역 전화번호는 최대 11자리입니다.';
    }
  } else {
    return '올바른 전화번호 형식이 아닙니다. (02, 010~019, 031~064로 시작)';
  }

  return null;
}

/**
 * 전화번호 예시 생성
 * @param numbers 입력된 숫자
 * @returns 예시 문자열
 */
export function getPhonePlaceholder(numbers: string): string {
  if (!numbers) return '010-1234-5678 또는 02-1234-5678';

  if (numbers.startsWith('02')) {
    return '02-123-4567 또는 02-1234-5678';
  }
  if (numbers.startsWith('01')) {
    return '010-1234-5678';
  }
  if (numbers.startsWith('0')) {
    return '031-123-4567';
  }

  return '010-1234-5678';
}
