import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { canUserApproveInspection } from '@/lib/utils/inspection-approval';

interface RejectBody {
  reason?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: inspectionId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id as string;

    // Parse request body for rejection reason
    const body: RejectBody = await request.json().catch(() => ({}));

    // Check if user can approve this inspection
    const canApprove = await canUserApproveInspection(userId, inspectionId);

    if (!canApprove) {
      return NextResponse.json(
        { error: 'You are not authorized to reject this inspection' },
        { status: 403 }
      );
    }

    // Get current inspection to verify status
    const inspection = await prisma.inspections.findUnique({
      where: { id: inspectionId }
    });

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Can only reject submitted inspections
    if (inspection.approval_status !== 'submitted') {
      return NextResponse.json(
        { error: `Cannot reject inspection with status: ${inspection.approval_status}. Only submitted inspections can be rejected.` },
        { status: 400 }
      );
    }

    // Rejection reason is optional but recommended
    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Update inspection to rejected
    const updatedInspection = await prisma.inspections.update({
      where: { id: inspectionId },
      data: {
        approval_status: 'rejected',
        approved_by_id: userId,
        approved_at: new Date(),
        rejection_reason: body.reason.trim()
      },
      include: {
        user_profiles: {
          select: {
            id: true,
            email: true,
            full_name: true,
            notification_settings: true
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

    // Log rejection action
    await prisma.audit_logs.create({
      data: {
        action: 'INSPECTION_REJECTED',
        user_id: userId,
        entity_id: inspectionId,
        entity_type: 'INSPECTION',
        metadata: {
          timestamp: new Date().toISOString(),
          rejected_by_email: session.user.email,
          equipment_serial: inspection.equipment_serial,
          reason: body.reason
        }
      }
    });

    // TODO: Send notification to inspector (updatedInspection.user_profiles.email)
    // Notify them that inspection was rejected and they need to re-inspect or fix issues

    return NextResponse.json({
      success: true,
      message: 'Inspection rejected successfully',
      inspection: updatedInspection
    });

  } catch (error) {
    console.error('Failed to reject inspection:', error);
    return NextResponse.json(
      { error: 'Failed to reject inspection' },
      { status: 500 }
    );
  }
}
