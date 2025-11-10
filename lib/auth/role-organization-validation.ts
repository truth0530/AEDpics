import type { PrismaClient } from '@prisma/client';
import type { UserRole } from '@/packages/types';
import {
  getAllowedOrganizationTypes,
  getOrganizationTypeLabel,
  isValidRoleOrganizationMatch,
  type OrganizationType
} from '@/lib/constants/role-organization-mapping';

type OrganizationRecord = {
  id: string;
  name: string | null;
  type: string | null;
};

export interface RoleOrganizationValidationOptions {
  organizationRecord?: OrganizationRecord | null;
}

export interface RoleOrganizationValidationResult {
  isValid: boolean;
  organization?: OrganizationRecord | null;
  error?: string;
  details?: {
    requiredTypes: string;
    providedType: string | null;
    organizationName: string | null;
  };
}

export async function validateRoleOrganizationAssignment(
  prismaClient: PrismaClient,
  role: UserRole | null | undefined,
  organizationId: string | null | undefined,
  options: RoleOrganizationValidationOptions = {}
): Promise<RoleOrganizationValidationResult> {
  if (!role || !organizationId) {
    return { isValid: true };
  }

  const organization =
    options.organizationRecord ??
    (await prismaClient.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, type: true }
    }));

  if (!organization) {
    return {
      isValid: false,
      error: '선택한 조직을 찾을 수 없습니다.'
    };
  }

  const allowedTypes = getAllowedOrganizationTypes(role);

  // 허용 타입이 비어 있으면 추가 검증 필요 없음
  if (allowedTypes.length === 0) {
    return { isValid: true, organization };
  }

  const organizationType = organization.type as OrganizationType | null;

  if (!organizationType) {
    return {
      isValid: false,
      organization,
      error: '조직에 타입 정보가 없어 역할을 부여할 수 없습니다.'
    };
  }

  const isMatch = isValidRoleOrganizationMatch(role, organizationType);

  if (!isMatch) {
    const requiredTypes = allowedTypes.map(getOrganizationTypeLabel).join(', ');
    return {
      isValid: false,
      organization,
      error: `${role} 역할은 "${organization.name ?? '선택한 조직'}" (${getOrganizationTypeLabel(organizationType)}) 조직에 부여할 수 없습니다.`,
      details: {
        requiredTypes,
        providedType: organization.type,
        organizationName: organization.name
      }
    };
  }

  return { isValid: true, organization };
}
