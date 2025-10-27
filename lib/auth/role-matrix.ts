// 권한 기반 접근 제어 매트릭스
import { UserRole } from '@/packages/types';

interface RoleAccessConfig {
  canAccessInspection: boolean;
  canAccessAEDData: boolean;
  inspectionUIMode: 'admin-full' | 'local-full' | 'read-only' | 'assigned-only' | null;
  fallbackRoute: string;
  defaultLandingPage: string;
  requiresAuth: boolean;
}

// TypeScript가 8개 역할 모두 강제하도록 satisfies 사용
export const ROLE_ACCESS_MATRIX = {
  master: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'admin-full',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/admin/users',
    requiresAuth: true
  },
  emergency_center_admin: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'admin-full',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/admin/users',
    requiresAuth: true
  },
  regional_emergency_center_admin: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'admin-full',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/admin/users',
    requiresAuth: true
  },
  ministry_admin: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'read-only',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/dashboard',
    requiresAuth: true
  },
  regional_admin: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'read-only',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/dashboard',
    requiresAuth: true
  },
  local_admin: {
    canAccessInspection: true,
    canAccessAEDData: true,
    inspectionUIMode: 'local-full',
    fallbackRoute: '/dashboard',
    defaultLandingPage: '/inspection',
    requiresAuth: true
  },
  temporary_inspector: {
    canAccessInspection: true,
    canAccessAEDData: false,
    inspectionUIMode: 'assigned-only',
    fallbackRoute: '/inspection',
    defaultLandingPage: '/inspection',
    requiresAuth: true
  },
  pending_approval: {
    canAccessInspection: false,
    canAccessAEDData: false,
    inspectionUIMode: null,
    fallbackRoute: '/pending-approval',
    defaultLandingPage: '/pending-approval',
    requiresAuth: true
  },
  email_verified: {
    canAccessInspection: false,
    canAccessAEDData: false,
    inspectionUIMode: null,
    fallbackRoute: '/verify-email',
    defaultLandingPage: '/verify-email',
    requiresAuth: true
  },
  rejected: {
    canAccessInspection: false,
    canAccessAEDData: false,
    inspectionUIMode: null,
    fallbackRoute: '/rejected',
    defaultLandingPage: '/rejected',
    requiresAuth: true
  }
} as const satisfies Record<UserRole, RoleAccessConfig>;

// 타입 추출
export type RoleAccessMatrix = typeof ROLE_ACCESS_MATRIX;
export type AccessibleRole = keyof RoleAccessMatrix;
export type InspectionUIMode = RoleAccessConfig['inspectionUIMode'];

// 헬퍼 함수들
export function getRoleAccess(role: UserRole): RoleAccessConfig {
  return ROLE_ACCESS_MATRIX[role];
}

export function canAccessInspection(role: UserRole): boolean {
  return ROLE_ACCESS_MATRIX[role]?.canAccessInspection ?? false;
}

export function canAccessAEDData(role: UserRole): boolean {
  return ROLE_ACCESS_MATRIX[role]?.canAccessAEDData ?? false;
}

export function getInspectionUIMode(role: UserRole): InspectionUIMode {
  return ROLE_ACCESS_MATRIX[role]?.inspectionUIMode ?? null;
}

export function getFallbackRoute(role: UserRole): string {
  return ROLE_ACCESS_MATRIX[role]?.fallbackRoute ?? '/dashboard';
}

// 역할 검증 함수
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && role in ROLE_ACCESS_MATRIX;
}

// 역할별 UI 기능 권한
export interface UIFeaturePermissions {
  showFilters: boolean;
  showBulkActions: boolean;
  showExport: boolean;
  showScheduling: boolean;
  showStatistics: boolean;
  canEditData: boolean;
  canStartInspection: boolean;
}

export function getUIPermissions(role: UserRole, isMobile: boolean = false): UIFeaturePermissions {
  const mode = getInspectionUIMode(role);

  switch (mode) {
    case 'admin-full':
      return {
        showFilters: !isMobile,
        showBulkActions: true,
        showExport: true,
        showScheduling: true,
        showStatistics: true,
        canEditData: true,
        canStartInspection: true
      };

    case 'local-full':
      return {
        showFilters: !isMobile,
        showBulkActions: !isMobile,
        showExport: true,
        showScheduling: true,
        showStatistics: false,
        canEditData: true,
        canStartInspection: true
      };

    case 'read-only':
      return {
        showFilters: true,
        showBulkActions: false,
        showExport: true,
        showScheduling: false,
        showStatistics: true,
        canEditData: false,
        canStartInspection: false
      };

    case 'assigned-only':
      return {
        showFilters: false,
        showBulkActions: false,
        showExport: false,
        showScheduling: false,
        showStatistics: false,
        canEditData: false,
        canStartInspection: true
      };

    default:
      return {
        showFilters: false,
        showBulkActions: false,
        showExport: false,
        showScheduling: false,
        showStatistics: false,
        canEditData: false,
        canStartInspection: false
      };
  }
}