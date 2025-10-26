// 에러 처리 유틸리티

export type ErrorType =
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

interface ErrorMessage {
  type: ErrorType;
  title: string;
  message: string;
  action?: string;
}

// 사용자 친화적인 에러 메시지 매핑
const errorMessages: Record<string, ErrorMessage> = {
  // 인증 관련
  'Invalid login credentials': {
    type: 'AUTH_ERROR',
    title: '로그인 실패',
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    action: '다시 확인하고 시도해주세요.'
  },
  'Email not confirmed': {
    type: 'AUTH_ERROR',
    title: '이메일 미인증',
    message: '이메일 인증이 완료되지 않았습니다.',
    action: '받은편지함에서 인증 메일을 확인해주세요.'
  },
  'User already registered': {
    type: 'AUTH_ERROR',
    title: '이미 가입된 사용자',
    message: '해당 이메일로 이미 가입되어 있습니다.',
    action: '로그인하거나 비밀번호를 재설정해주세요.'
  },

  // 권한 관련
  'insufficient_permissions': {
    type: 'PERMISSION_ERROR',
    title: '권한 부족',
    message: '해당 작업을 수행할 권한이 없습니다.',
    action: '관리자에게 문의하세요.'
  },
  'new row violates row-level security policy': {
    type: 'PERMISSION_ERROR',
    title: '접근 권한 없음',
    message: '데이터에 접근할 권한이 없습니다.',
    action: '권한을 확인하고 다시 시도해주세요.'
  },

  // 네트워크 관련
  'Failed to fetch': {
    type: 'NETWORK_ERROR',
    title: '네트워크 오류',
    message: '서버와 연결할 수 없습니다.',
    action: '인터넷 연결을 확인하고 다시 시도해주세요.'
  },
  'Network request failed': {
    type: 'NETWORK_ERROR',
    title: '네트워크 요청 실패',
    message: '요청을 처리하는 중 문제가 발생했습니다.',
    action: '잠시 후 다시 시도해주세요.'
  },

  // 유효성 검증
  'Password should be at least 6 characters': {
    type: 'VALIDATION_ERROR',
    title: '비밀번호 형식 오류',
    message: '비밀번호는 최소 6자 이상이어야 합니다.',
    action: '더 긴 비밀번호를 입력해주세요.'
  },
  'Invalid email': {
    type: 'VALIDATION_ERROR',
    title: '이메일 형식 오류',
    message: '올바른 이메일 형식이 아닙니다.',
    action: '이메일 주소를 다시 확인해주세요.'
  },

  // 데이터 관련
  'duplicate key value violates unique constraint': {
    type: 'VALIDATION_ERROR',
    title: '중복된 데이터',
    message: '이미 존재하는 데이터입니다.',
    action: '다른 값을 입력해주세요.'
  },
  'referenced entity not found': {
    type: 'NOT_FOUND',
    title: '데이터를 찾을 수 없음',
    message: '요청한 정보를 찾을 수 없습니다.',
    action: '경로를 확인하고 다시 시도해주세요.'
  }
};

// 에러 코드 매핑
const errorCodeMessages: Record<string, ErrorMessage> = {
  '23505': {
    type: 'VALIDATION_ERROR',
    title: '중복된 데이터',
    message: '이미 등록된 정보입니다.',
    action: '다른 정보를 입력해주세요.'
  },
  '23503': {
    type: 'VALIDATION_ERROR',
    title: '참조 오류',
    message: '관련 데이터를 찾을 수 없습니다.',
    action: '데이터를 확인하고 다시 시도해주세요.'
  },
  '42501': {
    type: 'PERMISSION_ERROR',
    title: '권한 부족',
    message: '이 작업을 수행할 권한이 없습니다.',
    action: '관리자에게 문의하세요.'
  },
  'PGRST301': {
    type: 'PERMISSION_ERROR',
    title: '접근 거부',
    message: '보안 정책에 의해 접근이 거부되었습니다.',
    action: '권한을 확인해주세요.'
  }
};

// 기본 에러 메시지
const defaultErrorMessage: ErrorMessage = {
  type: 'UNKNOWN_ERROR',
  title: '오류 발생',
  message: '요청을 처리하는 중 문제가 발생했습니다.',
  action: '잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.'
};

/**
 * 에러를 사용자 친화적인 메시지로 변환
 */
export function getErrorMessage(error: unknown): ErrorMessage {
  // null/undefined 체크
  if (!error) {
    return defaultErrorMessage;
  }

  // 에러 객체 타입 체크
   
  const errorObj = error as any;

  // 에러 메시지 문자열
  const errorString = typeof error === 'string'
    ? error
    : errorObj.message || errorObj.error || '';

  // 에러 코드 체크
  const errorCode = errorObj.code || errorObj.error_code;
  if (errorCode && errorCodeMessages[errorCode]) {
    return errorCodeMessages[errorCode];
  }

  // 메시지 매칭
  for (const [key, value] of Object.entries(errorMessages)) {
    if (errorString.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Supabase 특정 에러
  if (errorObj.error_description) {
    return {
      type: 'AUTH_ERROR',
      title: '인증 오류',
      message: errorObj.error_description,
      action: '다시 로그인해주세요.'
    };
  }

  // HTTP 상태 코드 기반
  const status = errorObj.status || errorObj.statusCode;
  if (status) {
    switch (status) {
      case 400:
        return {
          type: 'VALIDATION_ERROR',
          title: '잘못된 요청',
          message: '입력한 정보가 올바르지 않습니다.',
          action: '입력 내용을 확인해주세요.'
        };
      case 401:
        return {
          type: 'AUTH_ERROR',
          title: '인증 필요',
          message: '로그인이 필요한 서비스입니다.',
          action: '로그인 후 다시 시도해주세요.'
        };
      case 403:
        return {
          type: 'PERMISSION_ERROR',
          title: '접근 거부',
          message: '해당 페이지에 접근할 권한이 없습니다.',
          action: '권한을 확인해주세요.'
        };
      case 404:
        return {
          type: 'NOT_FOUND',
          title: '페이지를 찾을 수 없음',
          message: '요청한 페이지를 찾을 수 없습니다.',
          action: '주소를 확인해주세요.'
        };
      case 500:
        return {
          type: 'SERVER_ERROR',
          title: '서버 오류',
          message: '서버에서 오류가 발생했습니다.',
          action: '잠시 후 다시 시도해주세요.'
        };
    }
  }

  // 커스텀 메시지가 있으면 사용
  if (errorString && errorString !== '[object Object]') {
    return {
      type: 'UNKNOWN_ERROR',
      title: '오류 발생',
      message: errorString,
      action: '문제가 지속되면 관리자에게 문의하세요.'
    };
  }

  return defaultErrorMessage;
}

/**
 * 에러 로깅 (개발 환경에서만)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔴 Error ${context ? `in ${context}` : ''}`);
    console.error('Original error:', error);
    console.error('Error message:', getErrorMessage(error));
    console.groupEnd();
  }
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(error: unknown): boolean {
  const errorMessage = getErrorMessage(error);
  return errorMessage.type === 'NETWORK_ERROR' ||
         errorMessage.type === 'SERVER_ERROR';
}

/**
 * 에러 타입별 아이콘 반환
 */
export function getErrorIcon(type: ErrorType): string {
  const icons: Record<ErrorType, string> = {
    'AUTH_ERROR': '🔒',
    'VALIDATION_ERROR': '⚠️',
    'NETWORK_ERROR': '🌐',
    'PERMISSION_ERROR': '🚫',
    'NOT_FOUND': '🔍',
    'SERVER_ERROR': '🖥️',
    'UNKNOWN_ERROR': '❓'
  };
  return icons[type] || '❗';
}