// 환경별 설정 및 데이터 소스 관리

import { env } from '@/lib/env';

export const ENV = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  isTutorial: env.NEXT_PUBLIC_TUTORIAL_MODE ?? false,
};

// 데이터 소스 설정
export const DATA_SOURCE = {
  // 개발 환경에서는 선택 가능
  useMockData: ENV.isDevelopment && (env.NEXT_PUBLIC_USE_MOCK_DATA ?? false),

  // 튜토리얼 페이지는 항상 모크 데이터
  tutorial: {
    alwaysUseMock: true,
    showWarning: true,
    warningMessage: '이 페이지는 데모용이며 실제 데이터를 포함하지 않습니다.'
  },

  // 실제 시스템은 항상 실제 데이터 + 인증 필수
  inspection: {
    requireAuth: true,
    useRealData: true,
    enableRLS: true
  }
};

// 접근 가능 경로 설정
export const ROUTES = {
  public: [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/tutorial',  // 모크 데이터만 사용
    '/tutorial2', // 모크 데이터만 사용
    '/tutorial3', // 모크 데이터만 사용
    '/presentation.html'
  ],

  protected: [
    '/dashboard',
    '/inspection',    // 실제 데이터, 인증 필수
    '/admin',        // 실제 데이터, 관리자만
    '/reports',      // 실제 데이터, 인증 필수
    '/profile'       // 실제 데이터, 인증 필수
  ],

  adminOnly: [
    '/admin/users',
    '/admin/organizations',
    '/admin/settings'
  ]
};

// 보안 설정
export const SECURITY = {
  // 세션 타임아웃 (밀리초)
  sessionTimeout: ENV.isProduction ? 30 * 60 * 1000 : 60 * 60 * 1000, // Production: 30분, Dev: 1시간

  // 비활성 타임아웃
  inactivityTimeout: 15 * 60 * 1000, // 15분

  // 최대 로그인 시도
  maxLoginAttempts: 5,

  // 로그인 시도 차단 시간
  lockoutDuration: 30 * 60 * 1000, // 30분

  // 비밀번호 정책
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
};

// API 엔드포인트 설정
export const API = {
  // 공개 API (인증 불필요)
  public: {
    health: '/api/health',
    status: '/api/status'
  },

  // 보호된 API (인증 필요)
  protected: {
    // devices endpoint removed - merged into inspection
    inspections: '/api/inspections',
    users: '/api/users',
    reports: '/api/reports'
  },

  // 관리자 API (관리자 권한 필요)
  admin: {
    users: '/api/admin/users',
    organizations: '/api/admin/organizations',
    analytics: '/api/admin/analytics'
  }
};

// 데이터 접근 권한 매트릭스
export const PERMISSIONS = {
  master: {
    canViewAllData: true,
    canEditAllData: true,
    canDeleteData: true,
    canManageUsers: true,
    canManageOrganizations: true,
    canViewAnalytics: true
  },

  emergency_center_admin: {
    canViewAllData: true,
    canEditAllData: false,
    canDeleteData: false,
    canManageUsers: true,
    canManageOrganizations: false,
    canViewAnalytics: true
  },

  regional_admin: {
    canViewAllData: false, // 지역 데이터만
    canEditAllData: false,
    canDeleteData: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAnalytics: true // 지역 통계만
  },

  local_admin: {
    canViewAllData: false, // 관할 데이터만
    canEditAllData: false,
    canDeleteData: false,
    canManageUsers: false,
    canManageOrganizations: false,
    canViewAnalytics: false
  }
};

// 로깅 설정
export const LOGGING = {
  // 기록할 이벤트 유형
  events: {
    auth: true,        // 로그인/로그아웃
    dataAccess: true,  // 데이터 조회
    dataModify: true,  // 데이터 수정
    errors: true,      // 에러 발생
    security: true     // 보안 이벤트
  },

  // 로그 보관 기간 (일)
  retentionDays: ENV.isProduction ? 90 : 7
};

const CONFIG = {
  ENV,
  DATA_SOURCE,
  ROUTES,
  SECURITY,
  API,
  PERMISSIONS,
  LOGGING
};

export default CONFIG;