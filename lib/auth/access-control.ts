// Access control functions for role-based and account-type-based permissions

import { UserRole, UserProfile } from '@/packages/types';
// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } // TODO: Supabase 클라이언트 임시 비활성화
// from '@/lib/supabase/client';
import { getRegionCode, mapCityCodeToGugun } from '@/lib/constants/regions';
import { logger } from '@/lib/logger';

/**
 * 도메인 기반 역할 허용 여부 검증
 * @param email 이메일 주소
 * @param role 부여하려는 역할
 * @returns 허용 여부 및 에러 메시지
 */
export function validateDomainForRole(email: string, role: UserRole): { allowed: boolean; error?: string; suggestedRole?: UserRole } {
  const emailDomain = email?.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return { allowed: false, error: '유효하지 않은 이메일 주소입니다.' };
  }

  // master 역할은 모든 도메인 허용
  if (role === 'master') {
    return { allowed: true };
  }

  const isNmcDomain = emailDomain === 'nmc.or.kr';
  const isKoreaDomain = emailDomain === 'korea.kr';
  const isGovernmentDomain = isNmcDomain || isKoreaDomain;

  // Case 1: @nmc.or.kr 도메인 - 응급센터 관리자만 가능
  if (isNmcDomain) {
    if (role === 'emergency_center_admin' || role === 'regional_emergency_center_admin') {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: `@nmc.or.kr 도메인은 응급센터 관리자 역할만 가능합니다.`,
      suggestedRole: 'regional_emergency_center_admin'
    };
  }

  // Case 2: @korea.kr 도메인 - 정부기관 관리자만 가능
  if (isKoreaDomain) {
    if (role === 'ministry_admin' || role === 'regional_admin' || role === 'local_admin') {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: `@korea.kr 도메인은 보건복지부/시도/보건소 관리자 역할만 가능합니다.`,
      suggestedRole: 'local_admin'
    };
  }

  // Case 3: 기타 도메인 - temporary_inspector만 가능
  if (role === 'temporary_inspector' || role === 'pending_approval' || role === 'email_verified') {
    return { allowed: true };
  }

  return {
    allowed: false,
    error: `비정부 도메인(@${emailDomain})은 임시 점검원 역할만 가능합니다.`,
    suggestedRole: 'temporary_inspector'
  };
}

/**
 * 이메일 도메인에 따라 허용 가능한 역할 목록 반환
 * @param email 이메일 주소
 * @returns 허용 가능한 역할 목록
 */
export function getAllowedRolesForDomain(email: string): UserRole[] {
  const emailDomain = email?.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return ['pending_approval', 'email_verified'];
  }

  // @nmc.or.kr - 응급센터 관리자
  if (emailDomain === 'nmc.or.kr') {
    return ['emergency_center_admin', 'regional_emergency_center_admin'];
  }

  // @korea.kr - 정부기관 관리자
  if (emailDomain === 'korea.kr') {
    return ['ministry_admin', 'regional_admin', 'local_admin'];
  }

  // 기타 도메인 - 임시 점검원
  return ['temporary_inspector'];
}

/**
 * 이메일 도메인 기반 기본 역할 제안
 * - @nmc.or.kr → emergency_center_admin (중앙응급센터 관리자)
 * - @korea.kr → local_admin (보건소 담당자)
 * - 기타 도메인 → temporary_inspector (임시점검원)
 */
export function suggestDefaultRole(email: string): UserRole {
  const emailDomain = email?.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return 'temporary_inspector';
  }

  // @nmc.or.kr - 응급센터 관리자 (기본: 중앙응급센터)
  if (emailDomain === 'nmc.or.kr') {
    return 'emergency_center_admin';
  }

  // @korea.kr - 정부기관 관리자 (기본: 보건소 담당자)
  if (emailDomain === 'korea.kr') {
    return 'local_admin';
  }

  // 기타 도메인 - 임시 점검원
  return 'temporary_inspector';
}

export interface AccessContext {
  userId: string;
  role: UserRole;
  accountType: 'public' | 'temporary';
  assignedDevices?: string[];
  organizationId?: string;
}

const READ_ONLY_ADMIN_ROLES: UserRole[] = ['ministry_admin', 'regional_admin'];
const SCHEDULE_MANAGER_ROLES: UserRole[] = [
  'master',
  'emergency_center_admin',
  'regional_emergency_center_admin',  // 응급의료지원센터 관리자 추가
  'local_admin'
];

export function isReadOnlyAdmin(role: UserRole): boolean {
  return READ_ONLY_ADMIN_ROLES.includes(role);
}

export function canManageSchedules(role: UserRole): boolean {
  return SCHEDULE_MANAGER_ROLES.includes(role);
}

// Get user access context
export async function getUserAccessContext(userId: string): Promise<AccessContext | null> {
  try {
    const { prisma } = await import('@/lib/prisma');

    const profile = await prisma.user_profiles.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        account_type: true,
        assigned_devices: true,
        organization_id: true
      }
    });

    if (!profile) {
      return null;
    }

    return {
      userId: profile.id,
      role: profile.role as UserRole,
      accountType: (profile.account_type as 'public' | 'temporary') || 'public',
      assignedDevices: profile.assigned_devices || [],
      organizationId: profile.organization_id || undefined
    };
  } catch (error) {
    logger.error('AccessControl:getUserAccessContext', 'Error getting user access context', error instanceof Error ? error : { error });
    return null;
  }
}

// Check if user can access a specific AED device
export function canAccessDevice(
  context: AccessContext,
  deviceId: string
): boolean {
  // Public account users can access all devices in their scope
  if (context.accountType === 'public') {
    // Master and emergency center admins can access all devices
    if (context.role === 'master' || context.role === 'emergency_center_admin') {
      return true;
    }
    // Other roles have organization-based access (handled by RLS)
    return true;
  }

  // Temporary inspectors can only access assigned devices
  if (context.accountType === 'temporary' && context.role === 'temporary_inspector') {
    return context.assignedDevices?.includes(deviceId) || false;
  }

  return false;
}

// Check if user can perform inspections
export function canPerformInspection(context: AccessContext): boolean {
  // Temporary inspectors (both temporary and public account types)
  if (context.role === 'temporary_inspector') {
    return true; // But only for assigned devices (enforced at device level)
  }

  // Public account users with appropriate roles
  if (context.accountType === 'public') {
    return ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'].includes(context.role);
  }

  return false;
}

// Check if user can view reports
export function canViewReports(context: AccessContext): boolean {
  // Public account users with appropriate roles
  if (context.accountType === 'public') {
    return ['master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'].includes(context.role);
  }

  // Temporary inspectors cannot view reports
  return false;
}

// Check if user can manage other users
export function canManageUsers(context: AccessContext): boolean {
  // Only public account users with admin roles
  if (context.accountType === 'public') {
    return ['master', 'emergency_center_admin', 'regional_emergency_center_admin'].includes(context.role);
  }

  return false;
}

// Check if user can approve pending accounts
export function canApproveAccounts(context: AccessContext): boolean {
  // Only public account users with admin roles
  if (context.accountType === 'public') {
    return ['master', 'emergency_center_admin', 'regional_emergency_center_admin'].includes(context.role);
  }

  return false;
}

// Check if user can assign devices to temporary inspectors
export function canAssignDevices(context: AccessContext): boolean {
  if (context.accountType !== 'public') {
    return false;
  }

  // Only schedule managers can assign devices; ministry/regional admins are read-only
  return canManageSchedules(context.role);
}

// Get filtered navigation items based on user access
export function getNavigationItems(context: AccessContext) {
  const items = [];

  // Dashboard - available to all logged-in users
  items.push({ name: '대시보드', href: '/dashboard', icon: 'dashboard' });

  // Inspections - available based on role
  if (canPerformInspection(context)) {
    items.push({ name: '점검 관리', href: '/inspections', icon: 'checklist' });
  }

  // AED Devices - merged into inspection page
  // Removed /devices route - now handled within /inspection based on role

  // Reports - only for public accounts with appropriate roles
  if (canViewReports(context)) {
    items.push({ name: '보고서', href: '/reports', icon: 'report' });
  }

  // User Management - only for admins
  if (canManageUsers(context)) {
    items.push({ name: '사용자 관리', href: '/users', icon: 'users' });
  }

  // Settings - available to all
  items.push({ name: '설정', href: '/settings', icon: 'settings' });

  return items;
}

// Get dashboard widgets based on user access
export function getDashboardWidgets(context: AccessContext) {
  const widgets = [];

  // Basic stats widget - available to all
  widgets.push('stats');

  // Inspection calendar - for users who can perform inspections
  if (canPerformInspection(context)) {
    widgets.push('inspection-calendar');
  }

  // Device map - for public accounts
  if (context.accountType === 'public') {
    widgets.push('device-map');
  }

  // Pending approvals - for admins
  if (canApproveAccounts(context)) {
    widgets.push('pending-approvals');
  }

  // Assigned devices - for temporary inspectors
  if (context.accountType === 'temporary' && context.role === 'temporary_inspector') {
    widgets.push('assigned-devices');
  }

  return widgets;
}

// AED 데이터 조회 전용 권한 시스템
interface RolePermissions {
  canViewAllRegions: boolean;
  maxResultLimit: number;
  canExportData: boolean;
  canViewSensitiveData: boolean;
  requiresRegionFilter: boolean;
  requiresCityFilter: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  master: {
    canViewAllRegions: true,
    maxResultLimit: 10000,
    canExportData: true,
    canViewSensitiveData: true,
    requiresRegionFilter: false,
    requiresCityFilter: false
  },
  emergency_center_admin: {
    canViewAllRegions: true,
    maxResultLimit: 10000,
    canExportData: true,
    canViewSensitiveData: true,
    requiresRegionFilter: false,
    requiresCityFilter: false
  },
  regional_emergency_center_admin: {
    canViewAllRegions: true,
    maxResultLimit: 10000,
    canExportData: true,
    canViewSensitiveData: true,
    requiresRegionFilter: false,
    requiresCityFilter: false
  },
  ministry_admin: {
    canViewAllRegions: true,
    maxResultLimit: 10000,
    canExportData: true,
    canViewSensitiveData: true,
    requiresRegionFilter: false,
    requiresCityFilter: false
  },
  regional_admin: {
    canViewAllRegions: false,
    maxResultLimit: 5000,
    canExportData: true,
    canViewSensitiveData: true,
    requiresRegionFilter: true,
    requiresCityFilter: false
  },
  local_admin: {
    canViewAllRegions: false,
    maxResultLimit: 1000,
    canExportData: true,
    canViewSensitiveData: false,
    requiresRegionFilter: true,
    requiresCityFilter: true
  },
  temporary_inspector: {
    canViewAllRegions: false,
    maxResultLimit: 500,
    canExportData: false,
    canViewSensitiveData: false,
    requiresRegionFilter: true,
    requiresCityFilter: true
  },
  pending_approval: {
    canViewAllRegions: false,
    maxResultLimit: 0,
    canExportData: false,
    canViewSensitiveData: false,
    requiresRegionFilter: true,
    requiresCityFilter: true
  },
  email_verified: {
    canViewAllRegions: false,
    maxResultLimit: 0,
    canExportData: false,
    canViewSensitiveData: false,
    requiresRegionFilter: true,
    requiresCityFilter: true
  },
  rejected: {
    canViewAllRegions: false,
    maxResultLimit: 0,
    canExportData: false,
    canViewSensitiveData: false,
    requiresRegionFilter: true,
    requiresCityFilter: true
  }
};

export interface UserAccessScope {
  permissions: RolePermissions;
  allowedRegionCodes: string[] | null;
  allowedCityCodes: string[] | null;
  userId: string;
}

export function resolveAccessScope(userProfile: UserProfile): UserAccessScope {
  const permissions = ROLE_PERMISSIONS[userProfile.role];
  const emailDomain = userProfile.email?.split('@')[1]?.toLowerCase();

  // ✅ CRITICAL: 도메인별 역할 제한 엄격 검증
  // 보안 정책: 이메일 도메인이 부여 가능한 역할을 결정함
  // 예외: master 역할은 모든 도메인 허용 (시스템 최고 관리자)

  if (userProfile.role !== 'master') {
    const GOVERNMENT_DOMAIN_ROLE_MAP: Record<string, UserRole[]> = {
      'nmc.or.kr': ['emergency_center_admin', 'regional_emergency_center_admin'],
      'korea.kr': ['ministry_admin', 'regional_admin', 'local_admin'],
    };

    const isGovernmentDomain = emailDomain === 'korea.kr' || emailDomain === 'nmc.or.kr';
    const allowedRolesForDomain = emailDomain ? GOVERNMENT_DOMAIN_ROLE_MAP[emailDomain] : undefined;

    // Case 1: 정부 도메인 사용자 - 해당 도메인에 맞는 역할만 가능
    if (isGovernmentDomain && allowedRolesForDomain) {
      if (!allowedRolesForDomain.includes(userProfile.role)) {
        logger.error('AccessControl:enforceStrictRoleByDomain', 'Access denied - invalid role for domain', {
          domain: emailDomain,
          allowedRoles: allowedRolesForDomain.join(', '),
          email: userProfile.email,
          role: userProfile.role
        });
        throw new Error(
          `[ACCESS_DENIED] Domain @${emailDomain} can only have roles: ${allowedRolesForDomain.join(', ')}. ` +
          `User ${userProfile.email} has invalid role: ${userProfile.role}. ` +
          `This violation has been logged.`
        );
      }
    }

    // Case 2: 비정부 도메인 사용자 - temporary_inspector만 가능
    if (!isGovernmentDomain) {
      const adminRoles: UserRole[] = [
        'emergency_center_admin',
        'regional_emergency_center_admin',
        'ministry_admin',
        'regional_admin',
        'local_admin',
      ];

      if (adminRoles.includes(userProfile.role)) {
        const requiredDomain =
          userProfile.role === 'emergency_center_admin' || userProfile.role === 'regional_emergency_center_admin'
            ? 'nmc.or.kr'
            : 'korea.kr';

        logger.error('AccessControl:enforceStrictRoleByDomain', 'Access denied - admin role requires government domain', {
          role: userProfile.role,
          requiredDomain,
          email: userProfile.email,
          actualDomain: emailDomain
        });
        throw new Error(
          `[ACCESS_DENIED] Role ${userProfile.role} requires government email domain @${requiredDomain}. ` +
          `User ${userProfile.email} with non-government domain @${emailDomain} can only have role: temporary_inspector. ` +
          `This violation has been logged.`
        );
      }
    }
  }

  let allowedRegionCodes: string[] | null = null;
  let allowedCityCodes: string[] | null = null;
  const normalizedRegionCode = (() => {
    if (userProfile.region_code) {
      return getRegionCode(userProfile.region_code);
    }
    if (userProfile.region) {
      return getRegionCode(userProfile.region);
    }
    return undefined;
  })();

  // 도메인과 조직 타입에 따른 권한 결정
  const isNMC = emailDomain === 'nmc.or.kr';
  const isKorea = emailDomain === 'korea.kr';

  // 전국 권한: @nmc.or.kr 또는 보건복지부(@korea.kr의 ministry_admin)
  const hasNationalAccess = isNMC ||
    (isKorea && userProfile.role === 'ministry_admin') ||
    userProfile.role === 'master' ||
    userProfile.role === 'emergency_center_admin' ||
    userProfile.role === 'regional_emergency_center_admin';

  if (hasNationalAccess) {
    // 전국 접근 가능: NULL로 제한 없음 표시
    allowedRegionCodes = null;
    allowedCityCodes = null;
  } else {
    // 지역 제한 역할 (@korea.kr의 시청/도청, 보건소)
    if (!normalizedRegionCode) {
      // temporary_inspector는 할당된 장비만 접근하므로 region_code 불필요
      // 빈 배열로 설정하여 일반 AED 데이터 접근은 차단되지만 에러는 발생하지 않음
      if (userProfile.role === 'temporary_inspector') {
        allowedRegionCodes = [];
        allowedCityCodes = [];
        return {
          permissions,
          allowedRegionCodes,
          allowedCityCodes,
          userId: userProfile.id,
        };
      }
      throw new Error(`User ${userProfile.id} requires region_code but none assigned`);
    }

    // 소속 시도로 고정
    allowedRegionCodes = [normalizedRegionCode];

    // local_admin(보건소): 시군구도 고정
    if (userProfile.role === 'local_admin') {
      const cityCode = userProfile.organization?.city_code;
      if (cityCode) {
        // city_code를 실제 gugun 이름으로 변환 (예: "seogwipo" → "서귀포시")
        // AED 데이터는 gugun 필드에 한글 이름을 저장하고 있음
        const mappedGugun = mapCityCodeToGugun(cityCode);
        allowedCityCodes = mappedGugun ? [mappedGugun] : [cityCode];
      } else {
        // city_code가 없으면 시도 레벨로만 제한 (시군구 제한 없음)
        // 향후 데이터 마이그레이션으로 모든 보건소에 city_code 추가 권장
        logger.warn('AccessControl:resolveAccessScope', 'Local admin organization missing city_code, granting region-level access', {
          userId: userProfile.id,
          email: userProfile.email
        });
        allowedCityCodes = null; // 시도 내 모든 시군구 접근 가능
      }
    } else if (userProfile.role === 'regional_admin') {
      // regional_admin(시청/도청): 시군구 선택 가능 (NULL = 제한 없음)
      allowedCityCodes = null;
    }
  }

  return {
    permissions,
    allowedRegionCodes,
    allowedCityCodes,
    userId: userProfile.id
  };
}

export function canAccessAEDData(user: UserRole | UserProfile): boolean {
  const role = typeof user === 'string' ? user : user.role;

  if (role === 'temporary_inspector') {
    return false;
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions || permissions.maxResultLimit <= 0) {
    return false;
  }

  if (typeof user !== 'string') {
    logger.info('AccessControl:canAccessAEDData', 'Checking AED data access', {
      email: user.email,
      role,
      organization: user.organization,
      organizations: (user as any).organizations
    });

    const allowedDomains = new Set(['korea.kr', 'nmc.or.kr']);
    const domainRestrictedRoles: UserRole[] = ['ministry_admin', 'regional_admin', 'local_admin'];
    const userDomain = user.email?.split('@')[1]?.toLowerCase();

    if (domainRestrictedRoles.includes(role)) {
      if (!userDomain || !allowedDomains.has(userDomain)) {
        logger.warn('AccessControl:canAccessAEDData', 'AED data access denied for domain', { domain: userDomain ?? 'unknown' });
        return false;
      }
    }

    try {
      resolveAccessScope(user);
      logger.info('AccessControl:canAccessAEDData', 'Access scope resolved successfully', { email: user.email });
    } catch (error) {
      logger.warn('AccessControl:canAccessAEDData', 'Skipping AED data access due to scope error', error instanceof Error ? error : { error });
      return false;
    }
  }

  return true;
}

export function canAccessInspectionMenu(user: UserRole | UserProfile): boolean {
  const role = typeof user === 'string' ? user : user.role;

  if (['pending_approval', 'email_verified'].includes(role)) {
    return false;
  }

  const allowedRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'regional_emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin',
    'temporary_inspector',
  ];

  if (!allowedRoles.includes(role)) {
    return false;
  }

  if (typeof user !== 'string') {
    try {
      resolveAccessScope(user);
    } catch (error) {
      logger.warn('AccessControl:canAccessInspectionMenu', 'Skipping inspection menu access due to scope error', error instanceof Error ? error : { error });
      return false;
    }
  }

  return true;
}

export function canAccessInspectionEffect(user: UserRole | UserProfile): boolean {
  const role = typeof user === 'string' ? user : user.role;

  // 승인되지 않은 역할 제외
  if (['pending_approval', 'email_verified', 'rejected'].includes(role)) {
    return false;
  }

  // temporary_inspector 제외 - 점검만 수행
  if (role === 'temporary_inspector') {
    return false;
  }

  // 점검효과에 접근 가능한 역할
  const allowedRoles: UserRole[] = [
    'master',
    'emergency_center_admin',
    'regional_emergency_center_admin',
    'ministry_admin',
    'regional_admin',
    'local_admin', // 보건소 담당자까지 접근 가능
  ];

  if (!allowedRoles.includes(role)) {
    return false;
  }

  if (typeof user !== 'string') {
    try {
      resolveAccessScope(user);
    } catch (error) {
      logger.warn('AccessControl:canAccessInspectionEffect', 'Skipping inspection effect access due to scope error', error instanceof Error ? error : { error });
      return false;
    }
  }

  return true;
}
