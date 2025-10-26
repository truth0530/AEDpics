// 인증 설정 및 권한 관리

import { UserRole } from '@/packages/types';

// 공공기관 이메일 도메인
export const PUBLIC_EMAIL_DOMAINS = ['korea.kr', 'nmc.or.kr'];

// 허용된 이메일 도메인 (공공기관 + 일반)
export const ALLOWED_EMAIL_DOMAINS = [
  ...PUBLIC_EMAIL_DOMAINS,
  'gmail.com',
  'naver.com',
  'daum.net',
  'kakao.com',
  'hanmail.net',
  'hotmail.com',
  'outlook.com',
  'yahoo.com'
];

// Master 관리자 이메일 (환경변수에서 가져오기)
export const getMasterAdminEmails = (): string[] => {
  const emails = process.env.MASTER_ADMIN_EMAILS || '';
  return emails.split(',').map(email => email.trim()).filter(Boolean);
};

// 권한별 접근 가능 기능
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  master: [
    'system.manage',
    'users.manage',
    'users.approve',
    'data.full_access',
    'reports.generate',
    'settings.modify',
    'database.manage'
  ],
  emergency_center_admin: [
    'users.manage',
    'users.approve',
    'data.full_access',
    'reports.generate',
    'settings.modify'
  ],
  ministry_admin: [
    'data.read',
    'data.modify',
    'reports.generate'
  ],
  regional_admin: [
    'data.regional_access',
    'data.modify',
    'reports.regional',
    'users.view'
  ],
  local_admin: [
    'data.local_access',
    'data.modify',
    'inspection.perform',
    'reports.local'
  ],
  temporary_inspector: [
    'data.assigned_devices_only',
    'inspection.perform_limited',
    'profile.view'
  ],
  pending_approval: [
    'profile.view',
    'profile.edit'
  ],
  email_verified: [
    'profile.create'
  ]
};

// 권한 체크 함수
export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

// 이메일 도메인 검증
export const isAllowedEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1];
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
};

// 공공기관 이메일 체크
export const isPublicEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1];
  return PUBLIC_EMAIL_DOMAINS.includes(domain);
};

// 계정 타입 결정
export type AccountType = 'public' | 'temporary';
export const getAccountType = (email: string): AccountType => {
  return isPublicEmailDomain(email) ? 'public' : 'temporary';
};

// Master 권한 체크
export const isMasterAdmin = (email: string): boolean => {
  const masterEmails = getMasterAdminEmails();
  return masterEmails.includes(email);
};

// 승인 권한 체크
// - Master 계정: 모든 사용자 승인 가능
// - 중앙응급의료센터 계정 (emergency_center_admin): 일반 사용자 및 신규 NMC 직원 승인 가능
// - 응급의료지원센터 계정 (regional_emergency_center_admin): 해당 지역 사용자 승인 가능
// - 이를 통해 NMC 직원간 상호 검증 및 승인 체계 구성
export const canApproveUsers = (role: UserRole): boolean => {
  return role === 'master' || role === 'emergency_center_admin' || role === 'regional_emergency_center_admin';
};

// 지역 권한 체크
export const hasRegionalAccess = (
  userRole: UserRole,
  userRegionCode: string | undefined,
  targetRegionCode: string
): boolean => {
  if (userRole === 'master' || userRole === 'emergency_center_admin' || userRole === 'ministry_admin') {
    return true; // 전국 권한
  }
  
  if (userRole === 'regional_admin' && userRegionCode) {
    return userRegionCode === targetRegionCode;
  }
  
  return false;
};

// 3단계 가입 프로세스 상태
export interface SignupStep {
  step: number;
  label: string;
  description: string;
  completed: boolean;
}

export const getSignupSteps = (userRole?: UserRole): SignupStep[] => {
  return [
    {
      step: 1,
      label: '이메일 인증',
      description: '공공기관 이메일로 인증',
      completed: userRole !== undefined && userRole !== 'email_verified'
    },
    {
      step: 2,
      label: '프로필 설정',
      description: '소속 및 담당 정보 입력',
      completed: userRole !== undefined && userRole !== 'email_verified' && userRole !== 'pending_approval'
    },
    {
      step: 3,
      label: '관리자 승인',
      description: '중앙응급의료센터 승인 대기',
      completed: userRole !== undefined && userRole !== 'email_verified' && userRole !== 'pending_approval'
    }
  ];
};