/**
 * User Profile Mapper
 *
 * Prisma 타입 (snake_case)과 UserProfile 인터페이스 (camelCase) 간 변환
 * 'as unknown as UserProfile' 타입 캐스팅을 제거하고 명시적 타입 변환 제공
 */

import type { user_profiles, organizations } from '@prisma/client';
import type { UserProfile, Organization } from '@/packages/types';

/**
 * Prisma user_profiles 타입 확장 (organizations 포함)
 */
export type PrismaUserProfileWithOrg = user_profiles & {
  organizations?: organizations | null;
};

/**
 * Prisma organizations → Organization 매핑
 */
export function mapOrganization(
  org: organizations | null | undefined
): Organization | undefined {
  if (!org) return undefined;

  return {
    id: org.id,
    name: org.name,
    type: org.type,
    parentId: org.parent_id ?? undefined,
    region_code: org.region_code ?? undefined,
    city_code: org.city_code ?? undefined,
    address: org.address ?? undefined,
    contact: org.contact ?? undefined,
    latitude: org.latitude ? Number(org.latitude) : undefined,
    longitude: org.longitude ? Number(org.longitude) : undefined,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

/**
 * Prisma user_profiles → UserProfile 매핑
 */
export function mapUserProfile(
  prismaProfile: PrismaUserProfileWithOrg
): UserProfile {
  return {
    id: prismaProfile.id,
    email: prismaProfile.email,
    fullName: prismaProfile.full_name,
    phone: prismaProfile.phone ?? undefined,
    organizationId: prismaProfile.organization_id ?? undefined,
    organization_name: prismaProfile.organization_name ?? undefined,
    organization: mapOrganization(prismaProfile.organizations),
    region: prismaProfile.region ?? undefined,
    region_code: prismaProfile.region_code ?? undefined,
    role: prismaProfile.role,
    isActive: prismaProfile.is_active,
    approvedBy: prismaProfile.approved_by ?? undefined,
    approvedAt: prismaProfile.approved_at ?? undefined,
    createdAt: prismaProfile.created_at,
    updatedAt: prismaProfile.updated_at,
  };
}

/**
 * 배열 매핑 헬퍼
 */
export function mapUserProfiles(
  prismaProfiles: PrismaUserProfileWithOrg[]
): UserProfile[] {
  return prismaProfiles.map(mapUserProfile);
}

/**
 * Null-safe 매핑
 */
export function mapUserProfileOrNull(
  prismaProfile: PrismaUserProfileWithOrg | null
): UserProfile | null {
  return prismaProfile ? mapUserProfile(prismaProfile) : null;
}

/**
 * 타입 가드: Prisma 타입인지 확인
 */
export function isPrismaUserProfile(
  profile: unknown
): profile is PrismaUserProfileWithOrg {
  if (!profile || typeof profile !== 'object') return false;

  const p = profile as Record<string, unknown>;

  // Prisma 타입의 필수 필드 확인 (snake_case)
  return (
    typeof p.id === 'string' &&
    typeof p.email === 'string' &&
    typeof p.full_name === 'string' &&
    typeof p.role === 'string' &&
    typeof p.is_active === 'boolean'
  );
}

/**
 * 타입 가드: UserProfile 타입인지 확인
 */
export function isUserProfile(profile: unknown): profile is UserProfile {
  if (!profile || typeof profile !== 'object') return false;

  const p = profile as Record<string, unknown>;

  // UserProfile 타입의 필수 필드 확인 (camelCase)
  return (
    typeof p.id === 'string' &&
    typeof p.email === 'string' &&
    typeof p.fullName === 'string' &&
    typeof p.role === 'string' &&
    typeof p.isActive === 'boolean'
  );
}

/**
 * 자동 변환: Prisma → UserProfile (타입 가드 포함)
 */
export function ensureUserProfile(
  profile: PrismaUserProfileWithOrg | UserProfile
): UserProfile {
  if (isUserProfile(profile)) {
    return profile;
  }

  if (isPrismaUserProfile(profile)) {
    return mapUserProfile(profile);
  }

  throw new Error('Invalid profile type: expected Prisma user_profiles or UserProfile');
}
