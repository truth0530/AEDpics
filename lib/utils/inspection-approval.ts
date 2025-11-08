import { prisma } from '@/lib/prisma';
import { user_role } from '@prisma/client';

/**
 * Determines who should approve an inspection based on organization structure
 *
 * Logic:
 * 1. If organization has local_admin → only local_admin can approve
 * 2. If organization has NO local_admin → regional_admin (17 emergency medical centers) can approve
 */
export async function getApproverForInspection(organizationId: string) {
  const organization = await prisma.organizations.findFirst({
    where: { id: organizationId },
    include: {
      user_profiles: {
        where: {
          role: 'local_admin',
          is_active: true
        },
        select: {
          id: true,
          email: true,
          full_name: true
        }
      }
    }
  });

  if (!organization) {
    return null;
  }

  // If organization has local_admin, they are the primary approver
  if (organization.user_profiles.length > 0) {
    return {
      approverType: 'local_admin' as const,
      approvers: organization.user_profiles,
      organizationId: organizationId
    };
  }

  // If no local_admin, find regional_admin for this region
  const regionalAdmin = await prisma.user_profiles.findFirst({
    where: {
      role: 'regional_admin',
      is_active: true,
      region_code: organization.region_code || undefined
    },
    select: {
      id: true,
      email: true,
      full_name: true
    }
  });

  if (regionalAdmin) {
    return {
      approverType: 'regional_admin' as const,
      approvers: [regionalAdmin],
      organizationId: organizationId
    };
  }

  // Fallback: master admin if neither local nor regional admin exists
  const masterAdmin = await prisma.user_profiles.findFirst({
    where: {
      role: 'master',
      is_active: true
    },
    select: {
      id: true,
      email: true,
      full_name: true
    }
  });

  return {
    approverType: 'master' as const,
    approvers: masterAdmin ? [masterAdmin] : [],
    organizationId: organizationId
  };
}

/**
 * Get pending inspections that need approval for a user
 *
 * Returns inspections where:
 * - approval_status is 'submitted' or 'pending'
 * - User is eligible to approve based on their role and organization
 */
export async function getPendingInspectionsForUser(userId: string) {
  const user = await prisma.user_profiles.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      organization_id: true,
      region_code: true
    }
  });

  if (!user) {
    return [];
  }

  // Master admin can see all pending inspections
  if (user.role === 'master') {
    return await prisma.inspections.findMany({
      where: {
        approval_status: {
          in: ['submitted', 'pending']
        }
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        approved_by: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
  }

  // Regional admin can see inspections from their region
  if (user.role === 'regional_admin') {
    return await prisma.inspections.findMany({
      where: {
        approval_status: {
          in: ['submitted', 'pending']
        },
        user_profiles: {
          organizations: {
            region_code: user.region_code || undefined
          }
        }
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        approved_by: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
  }

  // Local admin can only see inspections from their organization
  if (user.role === 'local_admin' && user.organization_id) {
    return await prisma.inspections.findMany({
      where: {
        approval_status: {
          in: ['submitted', 'pending']
        },
        user_profiles: {
          organization_id: user.organization_id
        }
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        approved_by: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
  }

  return [];
}

/**
 * Check if user can approve an inspection
 *
 * Rules:
 * - Master can approve any inspection
 * - Regional_admin can approve inspections from their region (when no local_admin exists)
 * - Local_admin can approve inspections from their organization
 */
export async function canUserApproveInspection(userId: string, inspectionId: string): Promise<boolean> {
  const user = await prisma.user_profiles.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      organization_id: true,
      region_code: true
    }
  });

  if (!user) {
    return false;
  }

  // Master can approve anything
  if (user.role === 'master') {
    return true;
  }

  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    include: {
      user_profiles: {
        select: {
          organization_id: true,
          organizations: {
            select: {
              region_code: true,
              user_profiles: {
                where: {
                  role: 'local_admin',
                  is_active: true
                },
                select: { id: true }
              }
            }
          }
        }
      }
    }
  });

  if (!inspection || !inspection.user_profiles) {
    return false;
  }

  const inspectorOrg = inspection.user_profiles.organizations;
  if (!inspectorOrg) {
    return false;
  }

  // Local admin can approve if inspector is in their organization
  if (user.role === 'local_admin' && user.organization_id) {
    return inspection.user_profiles.organization_id === user.organization_id;
  }

  // Regional admin can approve if:
  // 1. Inspector is in their region
  // 2. Organization has NO local_admin (so regional_admin is delegated)
  if (user.role === 'regional_admin') {
    const hasLocalAdmin = inspectorOrg.user_profiles.length > 0;
    return !hasLocalAdmin && inspectorOrg.region_code === user.region_code;
  }

  return false;
}

/**
 * Get inspection approval status summary for dashboard
 */
export async function getInspectionApprovalStats() {
  const stats = await prisma.inspections.groupBy({
    by: ['approval_status'],
    _count: true
  });

  return stats.reduce(
    (acc, stat) => ({
      ...acc,
      [stat.approval_status || 'null']: stat._count
    }),
    {}
  );
}
