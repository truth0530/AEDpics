import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { getApproverForInspection } from '@/lib/utils/inspection-approval';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inspectionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the inspection to find its organization
    const inspection = await prisma.inspections.findUnique({
      where: { id: inspectionId },
      include: {
        user_profiles: {
          select: {
            id: true,
            full_name: true,
            organization_id: true,
            organizations: {
              select: {
                id: true,
                name: true,
                region_code: true
              }
            }
          }
        },
        approved_by: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      }
    });

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    if (!inspection.user_profiles?.organization_id) {
      return NextResponse.json(
        { error: 'Inspection has no associated organization' },
        { status: 400 }
      );
    }

    // Get the approver information
    const approverInfo = await getApproverForInspection(inspection.user_profiles.organization_id);

    return NextResponse.json({
      success: true,
      inspectionId,
      currentStatus: inspection.approval_status,
      approverType: approverInfo?.approverType,
      approvers: approverInfo?.approvers || [],
      organization: inspection.user_profiles.organizations,
      inspector: {
        id: inspection.inspector_id,
        name: inspection.user_profiles.full_name
      },
      currentApprover: inspection.approved_by ? {
        id: inspection.approved_by.id,
        email: inspection.approved_by.email,
        name: inspection.approved_by.full_name
      } : null
    });

  } catch (error) {
    console.error('Failed to fetch approvers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvers' },
      { status: 500 }
    );
  }
}
