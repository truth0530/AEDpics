import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import type { UserProfile } from '@/packages/types';

const prisma = new PrismaClient();

/**
 * 사용자 프로필 조회 (React Cache API 사용)
 * 동일한 요청 내에서 중복 조회 방지
 *
 * TODO: Prisma로 완전히 전환 완료
 */
export const getCachedUserProfile = cache(async (userId: string): Promise<UserProfile | null> => {
  try {
    const profile = await prisma.user_profiles.findUnique({
      where: { id: userId },
      include: {
        organizations: true
      }
    });

    if (!profile) {
      console.error('[getCachedUserProfile] Profile not found for user:', userId);
      return null;
    }

    // Prisma 데이터를 UserProfile 타입으로 변환
    const typedProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name || profile.email,
      phone: profile.phone || undefined,
      organizationId: profile.organization_id || undefined,
      organization: (profile.organizations as any) || undefined,
      region: profile.region || undefined,
      region_code: profile.region_code || undefined,
      role: profile.role,
      isActive: profile.is_active,
      approvedBy: profile.approved_by || undefined,
      approvedAt: profile.approved_at || undefined,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    return typedProfile;
  } catch (error) {
    console.error('[getCachedUserProfile] Error fetching profile:', error);
    return null;
  }
});

/**
 * 승인 대기 중인 사용자 수 조회 (React Cache API 사용)
 *
 * TODO: Prisma로 완전히 전환 완료
 */
export const getCachedPendingApprovalCount = cache(async (): Promise<number> => {
  try {
    const count = await prisma.user_profiles.count({
      where: {
        role: 'pending_approval'
      }
    });

    return count;
  } catch (error) {
    console.error('[getCachedPendingApprovalCount] Error counting pending approvals:', error);
    return 0;
  }
});

/**
 * 현재 인증된 사용자 정보 조회 (React Cache API 사용)
 *
 * TODO: NextAuth로 완전히 전환 완료
 */
export const getCachedAuthUser = cache(async () => {
  try {
    const session = await getServerSession(authOptions);
    return session?.user || null;
  } catch (error) {
    console.error('[getCachedAuthUser] Error getting auth user:', error);
    return null;
  }
});
