// 에러 메시지 한글화 유틸리티

export interface ErrorInfo {
  title: string;
  message: string;
  action?: string;
}

// Supabase Auth 에러 메시지 매핑
const authErrorMap: Record<string, ErrorInfo> = {
  'Invalid login credentials': {
    title: '로그인 실패',
    message: '이메일 또는 비밀번호를 다시 확인해주세요.',
    action: '비밀번호를 잊으셨다면 비밀번호 찾기를 이용해주세요.'
  },
  'Email not confirmed': {
    title: '이메일 인증 필요',
    message: '이메일 인증이 완료되지 않았습니다.',
    action: '이메일함을 확인하여 인증을 완료해주세요.'
  },
  'User not found': {
    title: '사용자를 찾을 수 없습니다',
    message: '등록되지 않은 이메일입니다.',
    action: '회원가입을 먼저 진행해주세요.'
  },
  'Password should be at least 6 characters': {
    title: '비밀번호 오류',
    message: '비밀번호는 최소 6자 이상이어야 합니다.',
  },
  'Email rate limit exceeded': {
    title: '이메일 발송 제한',
    message: '이메일 발송 한도를 초과했습니다.',
    action: '잠시 후 다시 시도해주세요.'
  },
  'Signup not allowed for this email domain': {
    title: '가입 불가 도메인',
    message: '허용되지 않은 이메일 도메인입니다.',
    action: '공공기관 이메일 또는 허용된 도메인을 사용해주세요.'
  }
};

// Database 에러 메시지 매핑
const dbErrorMap: Record<string, ErrorInfo> = {
  'PGRST116': {
    title: '데이터 없음',
    message: '요청한 정보를 찾을 수 없습니다.'
  },
  'duplicate key value violates unique constraint': {
    title: '중복 데이터',
    message: '이미 존재하는 정보입니다.'
  },
  'permission denied': {
    title: '권한 없음',
    message: '이 작업을 수행할 권한이 없습니다.',
    action: '관리자에게 문의하세요.'
  },
  'row level security': {
    title: '접근 거부',
    message: '데이터에 접근할 권한이 없습니다.',
    action: '로그인 상태를 확인하고 다시 시도해주세요.'
  }
};

// 네트워크 에러 메시지 매핑
const networkErrorMap: Record<string, ErrorInfo> = {
  'Failed to fetch': {
    title: '네트워크 오류',
    message: '서버에 연결할 수 없습니다.',
    action: '인터넷 연결을 확인하고 다시 시도해주세요.'
  },
  'NetworkError': {
    title: '네트워크 오류',
    message: '네트워크 연결에 문제가 있습니다.',
    action: '잠시 후 다시 시도해주세요.'
  }
};

// 일반적인 에러 메시지
const genericErrorMap: Record<string, ErrorInfo> = {
  'timeout': {
    title: '시간 초과',
    message: '요청 처리 시간이 초과되었습니다.',
    action: '잠시 후 다시 시도해주세요.'
  },
  'server_error': {
    title: '서버 오류',
    message: '서버에서 오류가 발생했습니다.',
    action: '계속 문제가 발생하면 관리자에게 문의하세요.'
  }
};

/**
 * 에러 객체를 한글 메시지로 변환
 */
export function getKoreanErrorMessage(error: unknown): ErrorInfo {
  if (!error) {
    return {
      title: '알 수 없는 오류',
      message: '예상치 못한 오류가 발생했습니다.'
    };
  }

  let errorMessage = '';
  let errorCode = '';

  // Error 객체인 경우
  if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = (error as Error & { code?: string }).code || '';
  }
  // 문자열인 경우
  else if (typeof error === 'string') {
    errorMessage = error;
  }
  // 객체인 경우 (Supabase 에러 등)
  else if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    errorMessage = String(errorObj.message || errorObj.error || '');
    errorCode = String(errorObj.code || errorObj.error_code || '');
  }

  // 에러 코드로 먼저 매핑 시도
  if (errorCode && dbErrorMap[errorCode]) {
    return dbErrorMap[errorCode];
  }

  // 에러 메시지로 매핑 시도
  const lowerMessage = errorMessage.toLowerCase();

  // Auth 에러 확인
  for (const [key, value] of Object.entries(authErrorMap)) {
    if (errorMessage.includes(key) || lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Database 에러 확인
  for (const [key, value] of Object.entries(dbErrorMap)) {
    if (errorMessage.includes(key) || lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // 네트워크 에러 확인
  for (const [key, value] of Object.entries(networkErrorMap)) {
    if (errorMessage.includes(key) || lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // 일반 에러 확인
  for (const [key, value] of Object.entries(genericErrorMap)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }

  // 기본값 반환
  return {
    title: '오류 발생',
    message: errorMessage || '알 수 없는 오류가 발생했습니다.',
    action: '문제가 지속되면 관리자에게 문의하세요.'
  };
}

/**
 * 컴포넌트에서 사용하기 쉬운 단순 메시지 반환
 */
export function getSimpleErrorMessage(error: unknown): string {
  const errorInfo = getKoreanErrorMessage(error);
  return errorInfo.message;
}

/**
 * 상세한 에러 정보가 필요한 경우 사용
 */
export function getDetailedErrorMessage(error: unknown): string {
  const errorInfo = getKoreanErrorMessage(error);
  let message = errorInfo.message;
  if (errorInfo.action) {
    message += ` ${errorInfo.action}`;
  }
  return message;
}